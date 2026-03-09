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
| `RECTO_API_KEY` | API key for authenticating requests | *(required)* |

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

## OAuth (optional)

Used for MCP HTTP transport authentication. Only needed if you want OAuth instead of API key auth.

| Variable | Description | Default |
|----------|-------------|---------|
| `RECTO_ISSUER_URL` | OAuth issuer URL | *(none)* |
| `RECTO_ACCESS_TOKEN_TTL` | Access token TTL in seconds | `3600` |
| `RECTO_REFRESH_TOKEN_TTL` | Refresh token TTL in seconds | `7776000` |

## Web UI

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_RECTO_API_KEY` | API key for the web dashboard (same value as `RECTO_API_KEY`) | *(required for web)* |
| `VITE_RECTO_API_URL` | API base URL for the web dashboard | `/api` |

## Ports

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | API server port | `3000` |
| `MCP_PORT` | MCP server port | `3001` |
| `WEB_PORT` | Web dashboard port | `5173` |
| `DB_PORT` | PostgreSQL port | `5432` |

## Example `.env`

```bash
# Database
DATABASE_URL=postgresql://recto:recto@localhost:5432/recto
DB_PASSWORD=recto

# Required
RECTO_API_KEY=your-secret-key-here

# AI enrichment (pick one)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Semantic search (pick one)
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...

# OAuth (optional — only if using OAuth instead of API key)
# RECTO_ISSUER_URL=https://auth.example.com
# RECTO_ACCESS_TOKEN_TTL=3600
# RECTO_REFRESH_TOKEN_TTL=7776000

# Web dashboard
VITE_RECTO_API_KEY=your-secret-key-here

# Ports
API_PORT=3000
MCP_PORT=3001
WEB_PORT=5173
DB_PORT=5432
```
