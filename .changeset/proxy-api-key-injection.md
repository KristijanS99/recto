---
"@recto/web": minor
---

Move API key authentication from client-side to proxy-side injection

The web dashboard no longer requires `VITE_RECTO_API_KEY` as a build-time variable. Instead, Caddy injects the `Authorization: Bearer` header when proxying `/api` requests. This means:

- Pre-built GHCR images work out of the box without rebuilding
- The API key is never exposed to the browser
- `/api` routes are now behind basic auth for defense in depth
- Changing the API key only requires restarting the proxy, not rebuilding
