import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { oauthRoutes } from '../routes/oauth.js';

function createTestApp() {
  const app = new Hono();
  app.route('/', oauthRoutes({ issuerUrl: 'https://recto.example.com' }));
  return app;
}

describe('GET /.well-known/oauth-authorization-server', () => {
  it('returns OAuth metadata document', async () => {
    const app = createTestApp();
    const res = await app.request('/.well-known/oauth-authorization-server');
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.issuer).toBe('https://recto.example.com');
    expect(body.authorization_endpoint).toBe('https://recto.example.com/authorize');
    expect(body.token_endpoint).toBe('https://recto.example.com/token');
    expect(body.registration_endpoint).toBe('https://recto.example.com/register');
    expect(body.response_types_supported).toEqual(['code']);
    expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    expect(body.token_endpoint_auth_methods_supported).toEqual(['none', 'client_secret_post']);
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
  });
});
