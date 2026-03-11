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

| Client | Config field for URL | Auth methods | Config location |
|--------|---------------------|--------------|-----------------|
| Cursor | `url` | API key | `.cursor/mcp.json` or global settings |
| Claude Code | CLI flag | API key, OAuth | `claude mcp add recto --transport http https://<your-domain>/mcp` |
| Claude Desktop | `url` | OAuth | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Antigravity | `serverUrl` | API key, OAuth | MCP settings JSON |

Example for **Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "recto": {
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

Example for **Antigravity** (API key):

```json
{
  "mcpServers": {
    "recto": {
      "serverUrl": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

### OAuth Auth

Several MCP clients support OAuth 2.1 with PKCE, so you don't need to configure tokens manually — the client handles the OAuth flow automatically. When connecting, the client opens a browser where you enter your `RECTO_API_KEY` to authorize.

#### Claude Desktop

Add Recto to your config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "recto": {
      "url": "https://your-domain.com/mcp"
    }
  }
}
```

#### Claude Code

Just provide the URL — no headers needed:

```bash
claude mcp add recto --transport http https://your-domain.com/mcp
```

Claude Code will automatically discover the OAuth endpoints and open a browser for authorization.

#### Antigravity

Only the `serverUrl` is needed — no headers:

```json
{
  "mcpServers": {
    "recto": {
      "serverUrl": "https://your-domain.com/mcp"
    }
  }
}
```

Antigravity will prompt you to open the browser for OAuth authorization.

#### How it works

When a client connects without a Bearer token, Recto's OAuth flow kicks in:

1. The client discovers OAuth endpoints at `/.well-known/oauth-authorization-server`
2. A consent screen opens in your browser
3. You enter your `RECTO_API_KEY` to authorize
4. The client exchanges the authorization for access and refresh tokens

:::caution
OAuth requires a **publicly trusted HTTPS certificate**. Self-signed certificates (like Caddy's localhost cert) won't work. For testing, use a tunnel like [ngrok](https://ngrok.com): `ngrok http 80`. See [Deployment](/recto/deployment) for production setup.
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
