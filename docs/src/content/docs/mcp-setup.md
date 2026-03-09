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

Recto's MCP server uses Streamable HTTP transport. All clients connect via URL with a Bearer token (your `RECTO_API_KEY` or an OAuth access token).

**Default endpoint:** `http://localhost:3001/mcp` (configurable via `MCP_PORT`)

### Claude Desktop

Add to your Claude Desktop MCP configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "recto": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add recto --transport http http://localhost:3001/mcp
```

### Cursor

Add to your Cursor MCP configuration (`.cursor/mcp.json` in your project or global settings):

```json
{
  "mcpServers": {
    "recto": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

### Other HTTP-capable clients

Most MCP clients that support Streamable HTTP accept a `url` or `serverUrl` field:

```json
{
  "mcpServers": {
    "recto": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

## Verify the Connection

After configuring, test by asking your AI assistant:

> "Create a journal entry about setting up Recto for the first time."

If the entry is created successfully, you're all set. Check the web dashboard at [http://localhost:5173](http://localhost:5173) to see it.
