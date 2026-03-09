import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from '../db/connection.js';
import { oauthClients } from '../db/schema.js';
import { generateClientId, generateClientSecret, hashToken } from '../services/oauth.js';

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
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  // RFC 7591 — Dynamic Client Registration
  app.post('/register', zValidator('json', registrationSchema), async (c) => {
    if (!config.db) {
      return c.json({ error: 'Registration not available' }, 500);
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

    return c.json(response, 201);
  });

  return app;
}
