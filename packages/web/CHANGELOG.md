# @recto/web

## 0.4.0

### Minor Changes

- 2562a05: Move API key authentication from client-side to proxy-side injection

  The web dashboard no longer requires `VITE_RECTO_API_KEY` as a build-time variable. Instead, Caddy injects the `Authorization: Bearer` header when proxying `/api` requests. This means:
  - Pre-built GHCR images work out of the box without rebuilding
  - The API key is never exposed to the browser
  - `/api` routes are now behind basic auth for defense in depth
  - Changing the API key only requires restarting the proxy, not rebuilding

## 0.3.0

### Minor Changes

- 2fce516: Add Caddy reverse proxy with basic auth for web UI, remove nginx, consolidate deployment configuration, and overhaul all documentation with deployment guides, MCP client configs, and troubleshooting.

## 0.2.0

### Minor Changes

- b3c83d7: Add OAuth 2.1 authorization for MCP (dynamic client registration, PKCE, token refresh with rotation, expired token cleanup), switch MCP to HTTP-only transport with stateless Streamable HTTP, inject MCP instructions via instructions field, extract roadmap into dedicated page, and set docs dark theme as default.

## 0.1.2

### Patch Changes

- d309d4a: Add Settings page with Instructions and Prompts management UI

## 0.1.1

### Patch Changes

- 36adcb1: Add automated release workflow with changesets and fixed versioning across all packages
