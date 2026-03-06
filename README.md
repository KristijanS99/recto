<p align="center">
  <img src="logo.png" width="200" alt="Recto logo" />
</p>

<h1 align="center">recto</h1>

<p align="center">
  <i>Your journal lives where your thoughts already are — in conversation with AI.</i>
</p>

<p align="center">
  <a href="https://github.com/KristijanS99/recto/actions/workflows/ci.yml"><img src="https://github.com/KristijanS99/recto/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/KristijanS99/recto/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg" alt="Node >= 22" />
  <a href="https://github.com/KristijanS99/recto/pulls"><img src="https://img.shields.io/badge/PRs-welcome-orange.svg" alt="PRs Welcome" /></a>
</p>

---

## The name

> **recto** — from Latin *rectō*, meaning _"on the right side."_
>
> In bookbinding, the **recto** is the right-hand page of an open book — the front page, the one you see first. It's where the story begins.
>
> Every journal entry is a new recto: a fresh page, waiting for your thoughts.

---

## See it in action

```
You:     I had mass today and reflected on something the priest said about
         patience. It really stuck with me — how patience isn't passive,
         it's an active form of trust.

Claude:  ✓ Saved journal entry.
         ↳ Auto-tagged: #reflection #faith #patience
         ↳ Mood detected: contemplative

         Would you like to explore what you've written about patience before?

You:     Yeah, search my journal for patience.

Claude:  Found 3 entries mentioning patience:

         1. Today — "patience isn't passive, it's an active form of trust"
         2. Feb 18 — "struggling with patience at work, deadlines piling up"
         3. Jan 5 — "new year resolution: be more patient with myself"

         There's an interesting thread here — your understanding of patience
         has shifted from something you struggle with to something you see
         as a strength. Want me to write a reflection on that?

You:     Yes, reflect on my relationship with patience.

Claude:  Here's what I see across your entries...

         In January, patience felt like a burden — something you needed to
         "get better at." By February, you were noticing where it was hard.
         Now in March, you're finding wisdom in it.

         You're not just becoming more patient. You're redefining what
         patience means to you — from endurance to trust.
```

---

## What is Recto?

Recto is an **open-source, self-hosted journal backend** for developers. It lets you store, search, and reflect on your thoughts through any AI assistant — no app required.

The primary journaling interface isn't a UI. It's your AI assistant (Claude, ChatGPT, Cursor, etc.) connected via [Model Context Protocol (MCP)](https://modelcontextprotocol.io). Recto is a **data platform first**, with a lightweight web UI for browsing and reviewing entries.

---

## Highlights

- **MCP-native** — designed from the ground up to work with AI assistants via Model Context Protocol
- **Hybrid search** — full-text (BM25) + semantic vector search, fused with Reciprocal Rank Fusion
- **Self-hosted** — Docker Compose, one command, your data never leaves your machine
- **AI-agnostic** — bring your own API key: Anthropic, OpenAI, or local models via Ollama
- **Progressive enhancement** — works with zero AI config (plain text + keyword search), gets smarter when you add API keys
- **Single API key auth** — simple, no-fuss security for your self-hosted instance

---

## Architecture

Recto is a TypeScript monorepo with three packages:

```
recto/
├── packages/
│   ├── api/     @recto/api   — Hono REST API, PostgreSQL + pgvector, Drizzle ORM
│   ├── mcp/     @recto/mcp   — MCP server (stdio + HTTP/SSE), the AI journaling interface
│   └── web/     @recto/web   — React + Vite dashboard for browsing entries
```

| Package | Role | Stack |
|---------|------|-------|
| `@recto/api` | REST API & data layer | Hono, Drizzle ORM, PostgreSQL, pgvector |
| `@recto/mcp` | AI assistant interface | MCP SDK, stdio + HTTP/SSE transports |
| `@recto/web` | Read-only web dashboard | React, Vite, Tailwind CSS, TanStack Query |

---

## Quick start

```bash
# Clone the repo
git clone https://github.com/KristijanS99/recto.git
cd recto

# Start everything with Docker
docker compose up -d

# That's it. Recto is running at http://localhost:3000
```

### Connect your AI assistant

Add Recto as an MCP server in your assistant's config:

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

Then just start journaling by talking to your AI. It's that simple.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22, ESM, TypeScript (strict) |
| API framework | [Hono](https://hono.dev) |
| Database | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) |
| ORM | [Drizzle](https://orm.drizzle.team) |
| MCP | [Model Context Protocol SDK](https://modelcontextprotocol.io) |
| Frontend | React + Vite + Tailwind CSS |
| Monorepo | pnpm workspaces + [Turborepo](https://turbo.build) |
| Linting | [Biome](https://biomejs.dev) |
| Testing | [Vitest](https://vitest.dev) + Testcontainers |

---

## Development

```bash
# Install dependencies
pnpm install

# Run all packages in dev mode
pnpm dev

# Lint & format
pnpm lint

# Type check
pnpm typecheck

# Run tests
pnpm test

# Build everything
pnpm build
```

---

## Star History

<a href="https://star-history.com/#KristijanS99/recto&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=KristijanS99/recto&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=KristijanS99/recto&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=KristijanS99/recto&type=Date" />
 </picture>
</a>

---

## License

MIT — see [LICENSE](LICENSE) for details.

Built with care by [@KristijanS99](https://github.com/KristijanS99).
