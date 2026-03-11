---
title: MCP Setup
description: Connect your AI assistant to Recto via Model Context Protocol.
draft: false
---

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) is the standard for connecting AI assistants to external tools. Recto's MCP server gives your AI assistant the ability to create, search, and reflect on journal entries.

## How Instructions Work

When your AI client connects, Recto automatically sends your [custom instructions](/recto/instructions-and-prompts) as part of the MCP handshake. This tells the assistant how to behave (e.g., auto-capture entries, use tools proactively) — no tool call required.

## Available Tools

Once connected, your AI assistant can use these tools:

| Tool | Description |
|------|-------------|
| `create_entry` | Create a new journal entry |
| `get_entry` | Retrieve a specific entry |
| `list_entries` | List entries with optional filters |
| `search_entries` | Search by keyword, semantic similarity, or hybrid |
| `reflect` | Generate a reflection based on past entries |
| `add_tags` | Add tags to an entry |
| `get_summary` | Get an AI summary of recent entries |
| `add_media` | Attach a media URL to an entry |

## Built-in Prompts

MCP clients that support the Prompts API will automatically discover these prompt templates:

| Prompt | Description |
|--------|-------------|
| `daily-checkin` | Guided daily journal entry |
| `weekly-review` | Reflect on the past week |
| `monthly-retrospective` | Month-end review and goal assessment |
| `gratitude` | Gratitude-focused reflection |
| `idea-capture` | Develop and refine an idea |
| `goal-setting` | Set and break down goals |

You can also create custom prompts via the REST API or the web dashboard's Settings page. See [Instructions & Prompts](/recto/instructions-and-prompts) for details.

## Connecting Your AI Client

Recto's MCP server uses **Streamable HTTP** transport. There are two authentication methods:

- **API key** — pass your `RECTO_API_KEY` as a Bearer token (simplest setup)
- **OAuth 2.1** — the client handles authorization automatically (required by Claude Desktop)

### API Key Auth

Most MCP clients accept a URL and custom headers. Pass your API key as a Bearer token in the `Authorization` header.

The general pattern:

```json
{
  "mcpServers": {
    "recto": {
      "url": "https://<your-domain>/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

**Client-specific notes:**

| Client | Config field for URL | Config location |
|--------|---------------------|-----------------|
| Cursor | `url` | `.cursor/mcp.json` or global settings |
| Claude Code | CLI flag | `claude mcp add recto --transport http https://<your-domain>/mcp` |
| Antigravity | `serverUrl` | MCP settings JSON |

Example for **Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "recto": {
      "url": "https://localhost/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

Example for **Antigravity**:

```json
{
  "mcpServers": {
    "recto": {
      "serverUrl": "https://localhost/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key",
        "Content-Type": "application/json"
      }
    }
  }
}
```

### OAuth Auth (Claude Desktop)

Claude Desktop uses OAuth 2.1 with PKCE for MCP authentication. You don't need to configure tokens manually — Claude handles the OAuth flow automatically.

1. Add Recto to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "recto": {
      "url": "https://your-domain.com/mcp"
    }
  }
}
```

2. When Claude connects, it will:
   - Discover OAuth endpoints at `/.well-known/oauth-authorization-server`
   - Open a consent screen in your browser
   - Ask you to enter your `RECTO_API_KEY` to authorize
   - Exchange the authorization for access and refresh tokens

:::caution
OAuth requires a **publicly trusted HTTPS certificate**. Self-signed certificates (like Caddy's localhost cert) won't work with Claude Desktop. For testing, use a tunnel like [ngrok](https://ngrok.com): `ngrok http 80`. See [Deployment](/recto/deployment) for production setup.
:::

## Verify the Server

Confirm the MCP server is running:

```bash
curl http://localhost:3001/health
```

You should see `{"status":"ok"}`.

## Verify the Connection

After configuring, test by asking your AI assistant:

> "Create a journal entry about setting up Recto for the first time."

If the entry is created successfully, you're all set. Check the web dashboard at [https://localhost](https://localhost) to see it.
