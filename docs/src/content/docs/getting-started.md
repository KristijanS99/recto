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

Clone the repository and start all services:

```bash
git clone https://github.com/KristijanS99/recto.git
cd recto
cp .env.example .env
# Edit .env — at minimum set RECTO_API_KEY and VITE_RECTO_API_KEY
docker compose up -d
```

This starts five containers:

| Container | Purpose | Port |
|-----------|---------|------|
| `recto-db` | PostgreSQL + pgvector | 5432 |
| `recto-api` | REST API | 3000 |
| `recto-mcp` | MCP server (AI assistant interface) | 3001 |
| `recto-web` | Web dashboard | 5173 |
| `recto-proxy` | Caddy reverse proxy | 80 / 443 |

## Verify It Works

Check the health endpoint:

```bash
curl http://localhost:3000/health
```

You should see `{"status":"ok"}`. Open [http://localhost:5173](http://localhost:5173) to access the web dashboard directly, or [http://localhost](http://localhost) via the Caddy reverse proxy.

## Next Steps

1. **[Configure](/recto/configuration)** — Set up AI providers, API keys, and embedding models
2. **[Connect your AI assistant](/recto/mcp-setup)** — Add Recto as an MCP server
3. **Start journaling** — Talk to your AI assistant naturally. It handles the rest.
