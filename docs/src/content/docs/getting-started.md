---
title: Getting Started
description: Get Recto up and running in under a minute.
draft: false
---

Recto is a self-hosted journal backend that runs with Docker Compose. This guide will have you journaling through your AI assistant in minutes.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An AI assistant that supports MCP (Claude Desktop, Claude Code, Cursor, etc.)

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/KristijanS99/recto.git
cd recto
cp .env.example .env
```

Edit `.env` and set these required values:

| Variable | Description |
|----------|-------------|
| `RECTO_API_KEY` | Secret key for API auth (min 32 characters) |
| `VITE_RECTO_API_KEY` | Same value as above (used by the web dashboard) |
| `RECTO_WEB_PASSWORD_HASH` | Bcrypt hash for web UI login (see below) |

Generate the password hash:

```bash
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'your-password'
```

:::caution
The hash contains `$` characters. In your `.env` file, **escape every `$` as `$$`**:

```bash
# Output from caddy:  $2a$14$kCO...
# In .env, write:     $$2a$$14$$kCO...
```
:::

### 2. Start the stack

```bash
docker compose up -d
```

This starts four services:

| Container | Purpose | Port |
|-----------|---------|------|
| `recto-db` | PostgreSQL + pgvector | 5432 |
| `recto-api` | REST API | 3000 |
| `recto-mcp` | MCP server (AI assistant interface) | 3001 |
| `recto-proxy` | Caddy reverse proxy (TLS, auth, routing) | 80 / 443 |

A temporary `recto-web` container builds the dashboard files and exits — Caddy serves them directly.

### 3. Verify it works

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

Both should return `{"status":"ok"}`.

Open [https://localhost](https://localhost) to access the web dashboard. Your browser will warn about the self-signed certificate on localhost — accept it and log in with your username and password.

## Next Steps

1. **[Configure](/recto/configuration)** — Set up AI providers, API keys, and embedding models
2. **[Connect your AI assistant](/recto/mcp-setup)** — Add Recto as an MCP server
3. **[Deploy](/recto/deployment)** — Set up for production or remote access
4. **Start journaling** — Talk to your AI assistant naturally. It handles the rest.
