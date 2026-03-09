import { zValidator } from '@hono/zod-validator';
import { and, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { AUTH_CODE_EXPIRY_MS, HTTP_STATUS } from '../constants.js';
import type { Database } from '../db/connection.js';
import { accessTokens, authorizationCodes, oauthClients, refreshTokens } from '../db/schema.js';
import { safeEqual } from '../lib/crypto.js';
import {
  generateClientId,
  generateClientSecret,
  generateRandomToken,
  hashToken,
  verifyPkceChallenge,
} from '../services/oauth.js';
import { renderAuthorizePage } from '../templates/authorize.js';

export interface OAuthRoutesConfig {
  issuerUrl: string;
  db?: Database;
  apiKey?: string;
  accessTokenTtl?: number;
  refreshTokenTtl?: number;
}

const redirectUriSchema = z
  .string()
  .url()
  .refine((uri) => {
    const url = new URL(uri);
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      return true;
    return false;
  }, 'Redirect URIs must be HTTPS or localhost');

const registrationSchema = z.object({
  client_name: z.string().min(1),
  redirect_uris: z.array(redirectUriSchema).min(1),
  grant_types: z.array(z.string()).default(['authorization_code']),
  response_types: z.array(z.string()).default(['code']),
  token_endpoint_auth_method: z.enum(['none', 'client_secret_post']).default('none'),
});

export function oauthRoutes(config: OAuthRoutesConfig) {
  const app = new Hono();

  // RFC 8414 — OAuth Authorization Server Metadata
  app.get('/.well-known/oauth-authorization-server', (c) => {
    return c.json({
      issuer: config.issuerUrl,
      authorization_endpoint: `${config.issuerUrl}/authorize`,
      token_endpoint: `${config.issuerUrl}/token`,
      registration_endpoint: `${config.issuerUrl}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  // RFC 7591 — Dynamic Client Registration
  app.post('/register', zValidator('json', registrationSchema), async (c) => {
    if (!config.db) {
      return c.json({ error: 'Registration not available' }, HTTP_STATUS.INTERNAL);
    }

    const body = c.req.valid('json');
    const clientId = generateClientId();
    const isConfidential = body.token_endpoint_auth_method === 'client_secret_post';

    let clientSecretPlain: string | undefined;
    let clientSecretHash: string | undefined;

    if (isConfidential) {
      clientSecretPlain = generateClientSecret();
      clientSecretHash = hashToken(clientSecretPlain);
    }

    await config.db.insert(oauthClients).values({
      clientId,
      clientSecret: clientSecretHash ?? null,
      clientName: body.client_name,
      redirectUris: body.redirect_uris,
      grantTypes: body.grant_types,
      responseTypes: body.response_types,
      tokenEndpointAuthMethod: body.token_endpoint_auth_method,
    });

    const response: Record<string, unknown> = {
      client_id: clientId,
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      grant_types: body.grant_types,
      response_types: body.response_types,
      token_endpoint_auth_method: body.token_endpoint_auth_method,
    };

    if (isConfidential) {
      response.client_secret = clientSecretPlain;
    }

    return c.json(response, HTTP_STATUS.CREATED);
  });

  // --------------------------------------------------------------------------
  // GET /authorize — Render consent screen
  // --------------------------------------------------------------------------
  app.get('/authorize', async (c) => {
    if (!config.db) {
      return c.json({ error: 'Authorization not available' }, HTTP_STATUS.INTERNAL);
    }

    const responseType = c.req.query('response_type');
    const clientId = c.req.query('client_id');
    const redirectUri = c.req.query('redirect_uri');
    const state = c.req.query('state');
    const codeChallenge = c.req.query('code_challenge');
    const codeChallengeMethod = c.req.query('code_challenge_method');

    if (
      !responseType ||
      !clientId ||
      !redirectUri ||
      !state ||
      !codeChallenge ||
      !codeChallengeMethod
    ) {
      return c.json({ error: 'Missing required parameters' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (responseType !== 'code') {
      return c.json({ error: 'Unsupported response_type' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (codeChallengeMethod !== 'S256') {
      return c.text(
        'Bad Request: only S256 code_challenge_method is supported',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const [client] = await config.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1);

    if (!client) {
      return c.json({ error: 'Unknown client_id' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!client.redirectUris.includes(redirectUri)) {
      return c.json({ error: 'Invalid redirect_uri' }, HTTP_STATUS.BAD_REQUEST);
    }

    const html = renderAuthorizePage({
      clientName: client.clientName,
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
    });

    return c.html(html);
  });

  // --------------------------------------------------------------------------
  // POST /authorize — Validate API key and issue authorization code
  // --------------------------------------------------------------------------
  app.post('/authorize', async (c) => {
    if (!config.db) {
      return c.json({ error: 'Authorization not available' }, HTTP_STATUS.INTERNAL);
    }

    const body = await c.req.parseBody();
    const clientId = body.client_id as string | undefined;
    const redirectUri = body.redirect_uri as string | undefined;
    const state = body.state as string | undefined;
    const codeChallenge = body.code_challenge as string | undefined;
    const codeChallengeMethod = body.code_challenge_method as string | undefined;
    const apiKey = body.api_key as string | undefined;

    if (!clientId || !redirectUri || !state || !codeChallenge || !codeChallengeMethod) {
      return c.json({ error: 'Missing required parameters' }, HTTP_STATUS.BAD_REQUEST);
    }

    const [client] = await config.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1);

    if (!client) {
      return c.json({ error: 'Unknown client_id' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!client.redirectUris.includes(redirectUri)) {
      return c.json({ error: 'Invalid redirect_uri' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!apiKey || !config.apiKey || !safeEqual(apiKey, config.apiKey)) {
      const html = renderAuthorizePage({
        clientName: client.clientName,
        clientId,
        redirectUri,
        state,
        codeChallenge,
        codeChallengeMethod,
        error: 'Invalid API key',
      });
      return c.html(html);
    }

    // Generate authorization code with 10-minute expiry
    const code = generateRandomToken();
    const hashedCode = hashToken(code);
    const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

    await config.db.insert(authorizationCodes).values({
      code: hashedCode,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
    });

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', state);

    return c.redirect(redirectUrl.toString(), 302);
  });

  // --------------------------------------------------------------------------
  // POST /token — Exchange authorization code or refresh token for tokens
  // --------------------------------------------------------------------------
  app.post('/token', async (c) => {
    if (!config.db) {
      return c.json(
        { error: 'server_error', error_description: 'Token endpoint not available' },
        HTTP_STATUS.INTERNAL,
      );
    }

    const body = await c.req.parseBody();
    const grantType = body.grant_type as string | undefined;

    if (grantType === 'authorization_code') {
      const code = body.code as string | undefined;
      const codeVerifier = body.code_verifier as string | undefined;
      const clientId = body.client_id as string | undefined;
      const redirectUri = body.redirect_uri as string | undefined;

      if (!code || !codeVerifier || !clientId || !redirectUri) {
        return c.json(
          { error: 'invalid_request', error_description: 'Missing required parameters' },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Look up the authorization code
      const hashedCode = hashToken(code);
      const [authCode] = await config.db
        .select()
        .from(authorizationCodes)
        .where(
          and(
            eq(authorizationCodes.code, hashedCode),
            gt(authorizationCodes.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!authCode) {
        return c.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Delete code immediately (single-use, regardless of subsequent checks)
      await config.db.delete(authorizationCodes).where(eq(authorizationCodes.id, authCode.id));

      if (authCode.clientId !== clientId) {
        return c.json(
          { error: 'invalid_grant', error_description: 'Client ID mismatch' },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      if (authCode.redirectUri !== redirectUri) {
        return c.json(
          { error: 'invalid_grant', error_description: 'Redirect URI mismatch' },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Verify client secret for confidential clients
      const [oauthClient] = await config.db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.clientId, clientId))
        .limit(1);

      if (oauthClient?.tokenEndpointAuthMethod === 'client_secret_post') {
        const clientSecret = body.client_secret as string;
        if (!clientSecret || !oauthClient.clientSecret) {
          return c.json(
            { error: 'invalid_client', error_description: 'Client secret required' },
            HTTP_STATUS.UNAUTHORIZED,
          );
        }
        if (hashToken(clientSecret) !== oauthClient.clientSecret) {
          return c.json(
            { error: 'invalid_client', error_description: 'Invalid client secret' },
            HTTP_STATUS.UNAUTHORIZED,
          );
        }
      }

      // Verify PKCE
      if (!verifyPkceChallenge(codeVerifier, authCode.codeChallenge)) {
        return c.json(
          { error: 'invalid_grant', error_description: 'PKCE verification failed' },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Generate tokens
      const accessTokenPlain = generateRandomToken();
      const refreshTokenPlain = generateRandomToken();
      const accessTokenTtl = config.accessTokenTtl ?? 3600;
      const refreshTokenTtl = config.refreshTokenTtl ?? 7776000;

      // Store access token
      const storedAccessRows = await config.db
        .insert(accessTokens)
        .values({
          token: hashToken(accessTokenPlain),
          clientId,
          scopes: [],
          expiresAt: new Date(Date.now() + accessTokenTtl * 1000),
        })
        .returning({ id: accessTokens.id });

      const storedAccessToken = storedAccessRows[0];
      if (!storedAccessToken) {
        return c.json(
          { error: 'server_error', error_description: 'Failed to store token' },
          HTTP_STATUS.INTERNAL,
        );
      }

      // Store refresh token linked to access token
      await config.db.insert(refreshTokens).values({
        token: hashToken(refreshTokenPlain),
        clientId,
        accessTokenId: storedAccessToken.id,
        expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
      });

      return c.json({
        access_token: accessTokenPlain,
        refresh_token: refreshTokenPlain,
        token_type: 'Bearer',
        expires_in: accessTokenTtl,
      });
    }

    if (grantType === 'refresh_token') {
      const refreshToken = body.refresh_token as string | undefined;
      const clientId = body.client_id as string | undefined;

      if (!refreshToken || !clientId) {
        return c.json(
          { error: 'invalid_request', error_description: 'Missing required parameters' },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Look up the refresh token
      const hashedRefresh = hashToken(refreshToken);
      const [storedRefresh] = await config.db
        .select()
        .from(refreshTokens)
        .where(and(eq(refreshTokens.token, hashedRefresh), gt(refreshTokens.expiresAt, new Date())))
        .limit(1);

      if (!storedRefresh) {
        return c.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired refresh token' },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      if (storedRefresh.clientId !== clientId) {
        return c.json(
          { error: 'invalid_grant', error_description: 'Client ID mismatch' },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Verify client secret for confidential clients
      const [oauthClient] = await config.db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.clientId, clientId))
        .limit(1);

      if (oauthClient?.tokenEndpointAuthMethod === 'client_secret_post') {
        const clientSecret = body.client_secret as string;
        if (!clientSecret || !oauthClient.clientSecret) {
          return c.json(
            { error: 'invalid_client', error_description: 'Client secret required' },
            HTTP_STATUS.UNAUTHORIZED,
          );
        }
        if (hashToken(clientSecret) !== oauthClient.clientSecret) {
          return c.json(
            { error: 'invalid_client', error_description: 'Invalid client secret' },
            HTTP_STATUS.UNAUTHORIZED,
          );
        }
      }

      // Delete old refresh token and old access token (rotation)
      await config.db.delete(refreshTokens).where(eq(refreshTokens.id, storedRefresh.id));
      await config.db.delete(accessTokens).where(eq(accessTokens.id, storedRefresh.accessTokenId));

      // Generate new tokens
      const newAccessTokenPlain = generateRandomToken();
      const newRefreshTokenPlain = generateRandomToken();
      const accessTokenTtl = config.accessTokenTtl ?? 3600;
      const refreshTokenTtl = config.refreshTokenTtl ?? 7776000;

      const newAccessRows = await config.db
        .insert(accessTokens)
        .values({
          token: hashToken(newAccessTokenPlain),
          clientId,
          scopes: [],
          expiresAt: new Date(Date.now() + accessTokenTtl * 1000),
        })
        .returning({ id: accessTokens.id });

      const newStoredAccessToken = newAccessRows[0];
      if (!newStoredAccessToken) {
        return c.json(
          { error: 'server_error', error_description: 'Failed to store token' },
          HTTP_STATUS.INTERNAL,
        );
      }

      await config.db.insert(refreshTokens).values({
        token: hashToken(newRefreshTokenPlain),
        clientId,
        accessTokenId: newStoredAccessToken.id,
        expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
      });

      return c.json({
        access_token: newAccessTokenPlain,
        refresh_token: newRefreshTokenPlain,
        token_type: 'Bearer',
        expires_in: accessTokenTtl,
      });
    }

    return c.json(
      { error: 'unsupported_grant_type', error_description: 'Unsupported grant type' },
      HTTP_STATUS.BAD_REQUEST,
    );
  });

  return app;
}
