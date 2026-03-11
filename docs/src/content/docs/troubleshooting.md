---
title: Troubleshooting
description: Solutions for common Recto deployment issues.
draft: false
---

## Blank page at localhost

**Symptom:** `http://localhost` or `https://localhost` returns a blank page (200 OK, empty body).

**Cause:** `RECTO_DOMAIN` in your `.env` doesn't match the hostname you're accessing. Caddy only responds to requests matching the configured domain.

**Fix:** Set `RECTO_DOMAIN=localhost` in your `.env` and restart:

```bash
docker compose up -d --force-recreate proxy
```

## 308 Redirect loop

**Symptom:** Requests to the MCP or API return `308 Permanent Redirect` endlessly.

**Cause:** Caddy is redirecting HTTP to HTTPS, but a TLS-terminating proxy (ngrok, Cloudflare) is sending traffic to Caddy over HTTP — creating a loop.

**Fix:** Disable Caddy's auto-HTTPS:

```env
CADDY_GLOBAL_OPTIONS=auto_https off
```

Then restart: `docker compose up -d --force-recreate proxy`

## Web UI returns 401 on API calls

**Symptom:** The web dashboard loads but shows errors. Browser console shows `401 Unauthorized` on `/api/` requests.

**Cause:** `RECTO_API_KEY` is not set in the proxy environment, so Caddy cannot inject the Authorization header.

**Fix:** Ensure `RECTO_API_KEY` is set in your `.env` and restart the proxy:

```bash
docker compose up -d --force-recreate proxy
```

## Password hash not working

**Symptom:** Caddy logs show warnings like `The "kCOi..." variable is not set`, or basic auth doesn't prompt.

**Cause:** Bcrypt hashes contain `$` characters (e.g., `$2a$14$...`). Docker Compose interprets `$` as a variable reference.

**Fix:** Escape every `$` as `$$` in your `.env`:

```bash
# Hash from caddy:    $2a$14$kCOiXG77wJ...
# In .env, write:     $$2a$$14$$kCOiXG77wJ...
```

Then restart: `docker compose up -d --force-recreate proxy`

## OAuth not working with Claude Desktop

**Symptom:** Claude Desktop shows "There was an error connecting to the MCP server."

**Possible causes:**

1. **Self-signed certificate** — Claude Desktop requires a publicly trusted HTTPS cert. Use ngrok (`ngrok http 80`) or a real domain with Let's Encrypt.

2. **`RECTO_DOMAIN` includes the scheme** — Set only the hostname, not the full URL:
   ```env
   # Wrong:
   RECTO_DOMAIN=https://example.com
   # Correct:
   RECTO_DOMAIN=example.com
   ```

3. **OAuth endpoints not routed** — Verify that `/.well-known/oauth-authorization-server` returns JSON:
   ```bash
   curl https://your-domain/.well-known/oauth-authorization-server
   ```

## Container won't start

**Symptom:** `docker compose up -d` fails or a container keeps restarting.

**Fix:** Check the logs for the failing container:

```bash
docker compose logs api
docker compose logs mcp
docker compose logs proxy
```

Common causes:
- **API fails**: Database not ready — check `recto-db` health with `docker compose logs db`
- **MCP fails**: API not healthy — MCP depends on the API health check
- **Proxy fails**: Invalid Caddyfile syntax — check for unescaped `$` in password hash
