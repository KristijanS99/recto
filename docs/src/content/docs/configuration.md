---
title: Configuration
description: All environment variables for configuring Recto.
draft: false
---

Recto is configured entirely through environment variables. Copy `.env.example` to `.env` and adjust as needed.

## Database

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://recto:recto@localhost:5432/recto` |
| `DB_PASSWORD` | PostgreSQL password | `recto` |

## Core

| Variable | Description | Default |
|----------|-------------|---------|
| `RECTO_API_KEY` | API key for authenticating requests (min 32 characters) | *(required)* |

## AI Providers (LLM)

Used for auto-tagging, summarization, mood detection, and reflections. Configure **one** provider.

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | LLM provider: `anthropic` or `openai` | *(none)* |
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude) | *(none)* |
| `OPENAI_API_KEY` | OpenAI API key (for GPT-4o) | *(none)* |

:::note
Without an LLM provider, Recto still works for storing and keyword-searching entries. AI enrichment (auto-tagging, summaries, mood) and the `/reflect` endpoint require a configured LLM.
:::

## Embedding Providers

Used for semantic (vector) search. Configure **one** provider.

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_PROVIDER` | Provider: `openai`, `voyageai`, `ollama` | *(none)* |
| `VOYAGE_API_KEY` | VoyageAI API key | *(none)* |
| `OLLAMA_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_EMBEDDING_MODEL` | Ollama embedding model | `nomic-embed-text` |
| `EMBEDDING_DIMENSIONS` | Override auto-detected dimensions | *(auto)* |

Auto-detected dimensions per provider:

| Provider | Model | Dimensions |
|----------|-------|-----------|
| OpenAI | `text-embedding-3-small` | 1536 |
| VoyageAI | `voyage-3.5` | 1024 |
| Ollama | `nomic-embed-text` | 768 |

:::note
Without an embedding provider, search falls back to BM25 full-text search only. Hybrid search (combining keyword + semantic results) requires embeddings.
:::

## Domain & Proxy

| Variable | Description | Default |
|----------|-------------|---------|
| `RECTO_DOMAIN` | Domain for Caddy and OAuth issuer URL | `localhost` |
| `CADDY_GLOBAL_OPTIONS` | Caddy global options (set to `auto_https off` behind a TLS proxy) | *(none)* |
| `RECTO_ACCESS_TOKEN_TTL` | OAuth access token TTL in seconds | `3600` |
| `RECTO_REFRESH_TOKEN_TTL` | OAuth refresh token TTL in seconds | `7776000` |

`RECTO_DOMAIN` serves two purposes:
- Caddy listens on this domain and provisions TLS certificates automatically
- The OAuth issuer URL is derived as `https://<RECTO_DOMAIN>`

Set `CADDY_GLOBAL_OPTIONS=auto_https off` when running behind a TLS-terminating proxy (ngrok, Cloudflare, AWS ALB). See [Deployment](/recto/deployment) for details.

## Web UI Auth

Protects the web dashboard with HTTP basic auth when accessed through Caddy.

| Variable | Description | Default |
|----------|-------------|---------|
| `RECTO_WEB_USER` | Basic auth username | `admin` |
| `RECTO_WEB_PASSWORD_HASH` | Bcrypt hash of the password | *(required)* |

Generate the hash:

```bash
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'your-password'
```

:::caution
Bcrypt hashes contain `$` characters, which Docker Compose interprets as variable references. **Escape every `$` as `$$`** in your `.env` file.
:::

## Ports

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | API server port | `3000` |
| `MCP_PORT` | MCP server port | `3001` |
| `DB_PORT` | PostgreSQL port | `5432` |

## Example `.env`

```bash
# Database
DATABASE_URL=postgresql://recto:recto@localhost:5432/recto
DB_PASSWORD=recto

# Required (min 32 characters)
RECTO_API_KEY=change-me-to-a-secret-key-at-least-32-chars

# AI enrichment (pick one)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Semantic search (pick one)
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Domain & proxy
# RECTO_DOMAIN=localhost
# CADDY_GLOBAL_OPTIONS=auto_https off

# Web UI auth
RECTO_WEB_USER=admin
RECTO_WEB_PASSWORD_HASH=$$2a$$14$$...your-hash-here...

# Ports
API_PORT=3000
MCP_PORT=3001
DB_PORT=5432
```
