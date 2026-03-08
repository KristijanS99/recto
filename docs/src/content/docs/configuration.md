---
title: Configuration
description: All environment variables for configuring Recto.
draft: false
---

Recto is configured entirely through environment variables. Copy `.env.example` to `.env` and adjust as needed.

## Core

| Variable | Description | Default |
|----------|-------------|---------|
| `RECTO_API_KEY` | API key for authenticating requests | *(required)* |
| `PORT` | Port for the API server | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://recto:recto@localhost:5432/recto` |

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
| `VOYAGEAI_API_KEY` | VoyageAI API key | *(none)* |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
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

## Web UI

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_RECTO_API_KEY` | API key for the web dashboard (same value as `RECTO_API_KEY`) | *(required for web)* |
| `VITE_RECTO_API_URL` | API base URL for the web dashboard | `/api` |

## Example `.env`

```bash
# Required
RECTO_API_KEY=your-secret-key-here

# AI enrichment (pick one)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Semantic search (pick one)
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Web dashboard
VITE_RECTO_API_KEY=your-secret-key-here
```
