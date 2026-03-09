---
title: Instructions & Prompts
description: Customize how your AI assistant behaves with persistent instructions and prompt templates.
draft: false
---

Recto lets you control how your AI assistant interacts with your journal through two mechanisms: **instructions** and **prompt templates**.

## Instructions

Instructions are persistent system-level text that tells your AI assistant how to behave when journaling. They are automatically injected into your AI assistant's context when it connects via MCP — no action required from the assistant.

### Default behavior

Out of the box, Recto ships with default instructions that tell the assistant to:
- Automatically capture journal entries without asking for confirmation
- Operate naturally in the background
- Proactively enrich entries with context and tags
- Use search and reflect tools when appropriate

### Customizing instructions

**Via the web dashboard:** Go to Settings and select the Instructions tab. Edit the text and save.

**Via the REST API:**

```bash
# Get current instructions
curl -H "Authorization: Bearer $RECTO_API_KEY" \
  http://localhost:3000/instructions

# Update instructions
curl -X PUT -H "Authorization: Bearer $RECTO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Your custom instructions here..."}' \
  http://localhost:3000/instructions

# Reset to defaults
curl -X POST -H "Authorization: Bearer $RECTO_API_KEY" \
  http://localhost:3000/instructions/reset
```

:::note
Changes to instructions may take a few minutes to propagate due to server-side caching. Already-connected AI clients will receive the updated instructions on their next connection. Reconnect your AI client to apply changes immediately.
:::

## Prompt Templates

Prompt templates are reusable conversation starters that your AI assistant can offer. MCP clients that support the Prompts API will automatically discover them.

### Default prompts

Recto includes six built-in prompts:

| Prompt | Purpose |
|--------|---------|
| `daily-checkin` | Guided daily journal entry |
| `weekly-review` | Reflect on the past week |
| `monthly-retrospective` | Month-end review and goal assessment |
| `gratitude` | Gratitude-focused reflection |
| `idea-capture` | Develop and refine an idea |
| `goal-setting` | Set and break down goals |

### Managing prompts

**Via the web dashboard:** Go to Settings and select the Prompts tab. View, create, edit, or delete prompts.

**Via the REST API:**

```bash
# List all prompts
curl -H "Authorization: Bearer $RECTO_API_KEY" \
  http://localhost:3000/prompts

# Create a custom prompt
curl -X POST -H "Authorization: Bearer $RECTO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-prompt", "description": "A custom prompt", "content": "Template text..."}' \
  http://localhost:3000/prompts

# Update an existing prompt
curl -X PUT -H "Authorization: Bearer $RECTO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated template text..."}' \
  http://localhost:3000/prompts/<id>

# Reset a default prompt to its original content
curl -X POST -H "Authorization: Bearer $RECTO_API_KEY" \
  http://localhost:3000/prompts/<id>/reset
```

:::note
Default prompts cannot be deleted, but they can be edited and reset. Custom prompts can be deleted.
:::
