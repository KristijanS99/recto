---
title: Deployment
description: Deploy Recto for local development, production, or behind a reverse proxy.
draft: false
---

Recto runs as a set of Docker containers orchestrated by Docker Compose. Caddy serves as the single entry point — handling TLS, routing, and web UI authentication.

## Architecture

All traffic flows through Caddy on ports 80/443:

| Path | Destination | Auth |
|------|-------------|------|
| `/mcp`, `/mcp/*` | MCP server | API key or OAuth |
| `/api`, `/api/*` | REST API (strips `/api` prefix) | API key or OAuth |
| `/.well-known/oauth-authorization-server` | API (OAuth discovery) | None |
| `/authorize`, `/token`, `/register` | API (OAuth endpoints) | None |
| `/*` | Web dashboard (static files) | Basic auth |

## Deployment Options

### Pre-built images (recommended)

Uses pre-built images from GitHub Container Registry — no build step required:

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

### Build from source

Builds all images locally:

```bash
docker compose up -d
```

## Deployment Scenarios

### Local development

```env
RECTO_DOMAIN=localhost
```

Caddy generates a self-signed certificate for `localhost`. Your browser will show a security warning — accept it. Everything works except OAuth-based MCP clients (like Claude Desktop), which require a trusted certificate.

### Production (Caddy as the edge)

```env
RECTO_DOMAIN=recto.example.com
```

Caddy automatically provisions a [Let's Encrypt](https://letsencrypt.org/) TLS certificate. Ports 80 and 443 must be open and reachable from the internet. Everything works, including OAuth for Claude Desktop.

### Behind a TLS-terminating proxy (ngrok, Cloudflare, AWS ALB)

```env
RECTO_DOMAIN=your-domain.ngrok-free.app
CADDY_GLOBAL_OPTIONS=auto_https off
```

The external proxy handles TLS. Caddy serves plain HTTP on port 80. Set `RECTO_DOMAIN` to the **hostname only** (no `https://` prefix).

For ngrok testing:

```bash
ngrok http 80
# Copy the hostname (e.g., abc123.ngrok-free.app)
# Set RECTO_DOMAIN=abc123.ngrok-free.app in .env
# Set CADDY_GLOBAL_OPTIONS=auto_https off in .env
docker compose up -d --force-recreate api proxy
```

## Security Considerations

### Firewall direct ports

The API (3000), MCP (3001), and database (5432) ports are exposed on the host for convenience. In production, **firewall these ports** so that all traffic goes through Caddy on ports 80/443. Only Caddy enforces basic auth for the web UI.

### API key in the web bundle

The web dashboard's API key (`VITE_RECTO_API_KEY`) is baked into the JavaScript bundle at build time. Anyone who passes basic auth can see it in browser dev tools. This is acceptable for single-user self-hosted deployments but keep it in mind.

### Disabling the web dashboard

If you only use Recto through MCP (e.g., Claude Desktop), the web dashboard is unnecessary. Disabling it removes the basic auth attack surface — basic auth is vulnerable to brute force and doesn't support multi-factor authentication.

**1. Replace the Caddyfile catch-all handler**

Change the last `handle` block in your `Caddyfile` from serving static files to returning a 404:

```caddy
handle {
    respond 404
}
```

The full `Caddyfile` should look like this:

```caddy
{$CADDY_GLOBAL_OPTIONS}

{$RECTO_DOMAIN:localhost} {
	handle /mcp {
		reverse_proxy mcp:3001
	}

	handle /mcp/* {
		reverse_proxy mcp:3001
	}

	handle /.well-known/oauth-authorization-server {
		reverse_proxy api:3000
	}

	handle /authorize {
		reverse_proxy api:3000
	}

	handle /token {
		reverse_proxy api:3000
	}

	handle /register {
		reverse_proxy api:3000
	}

	handle /api {
		uri strip_prefix /api
		reverse_proxy api:3000
	}

	handle /api/* {
		uri strip_prefix /api
		reverse_proxy api:3000
	}

	handle {
		respond 404
	}
}
```

**2. Skip the web container**

Start the stack without building or running the web service:

```bash
# Pre-built images
docker compose -f docker-compose.ghcr.yml up -d --scale web=0

# Build from source
docker compose up -d --scale web=0
```

You can also remove `VITE_RECTO_API_KEY`, `RECTO_WEB_USER`, and `RECTO_WEB_PASSWORD_HASH` from your `.env` since they are no longer used.

**What you lose:** The web dashboard (timeline, search, tags, and settings pages). All MCP and API functionality continues to work normally.

### Rebuilding after key changes

Since `VITE_RECTO_API_KEY` is a build-time variable, changing the API key requires rebuilding the web container:

```bash
docker compose up -d --build web proxy
```
