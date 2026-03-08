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
docker compose up -d
```

This starts three containers:

| Container | Purpose | Port |
|-----------|---------|------|
| `recto-db` | PostgreSQL + pgvector | 5432 |
| `recto-api` | REST API | 3000 |
| `recto-web` | Web dashboard | 8080 |

## Verify It Works

Check the health endpoint:

```bash
curl http://localhost:3000/health
```

You should see `{"status":"ok"}`. Open [http://localhost:8080](http://localhost:8080) to see the web dashboard.

## Next Steps

1. **[Configure](/recto/configuration)** — Set up AI providers, API keys, and embedding models
2. **[Connect your AI assistant](/recto/mcp-setup)** — Add Recto as an MCP server
3. **Start journaling** — Talk to your AI assistant naturally. It handles the rest.
