---
title: MCP Setup
description: Connect your AI assistant to Recto via Model Context Protocol.
draft: false
---

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) is the standard for connecting AI assistants to external tools. Recto's MCP server gives your AI assistant the ability to create, search, and reflect on journal entries.

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

## Claude Desktop

Add to your Claude Desktop MCP configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "recto": {
      "command": "npx",
      "args": ["@recto/mcp"],
      "env": {
        "RECTO_API_URL": "http://localhost:3000",
        "RECTO_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "recto": {
      "command": "npx",
      "args": ["@recto/mcp"],
      "env": {
        "RECTO_API_URL": "http://localhost:3000",
        "RECTO_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Cursor

Add to your Cursor MCP configuration (`.cursor/mcp.json` in your project or global settings):

```json
{
  "mcpServers": {
    "recto": {
      "command": "npx",
      "args": ["@recto/mcp"],
      "env": {
        "RECTO_API_URL": "http://localhost:3000",
        "RECTO_API_KEY": "your-api-key"
      }
    }
  }
}
```

## HTTP/SSE Transport

For clients that support HTTP-based MCP, you can connect directly to the API's SSE endpoint instead of using stdio:

```
URL: http://localhost:3000/mcp/sse
Header: Authorization: Bearer your-api-key
```

## Verify the Connection

After configuring, test by asking your AI assistant:

> "Create a journal entry about setting up Recto for the first time."

If the entry is created successfully, you're all set. Check the web dashboard at [http://localhost:8080](http://localhost:8080) to see it.
