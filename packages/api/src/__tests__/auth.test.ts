import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { authMiddleware } from '../middleware/auth.js';

const API_KEY = 'test-api-key-123';

function createTestApp(apiKey: string) {
  const app = new Hono();
  app.use('/*', authMiddleware(apiKey));
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

describe('authMiddleware', () => {
  const app = createTestApp(API_KEY);

  it('returns 401 with missing Authorization header message when no header is provided', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' },
    });
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: API_KEY },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });

  it('returns 401 when Bearer token does not match the API key', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });

  it('returns 401 for empty Bearer token', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });

  it('allows request with correct Bearer token and returns 200', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('is case-sensitive for Bearer prefix (lowercase bearer returns 401)', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: `bearer ${API_KEY}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });
});
