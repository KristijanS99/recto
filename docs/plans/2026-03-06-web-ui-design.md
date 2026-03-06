# Web UI Design

## Overview
Minimal, read-only web UI for browsing journal entries. A viewer, not a journaling interface.

## Stack
- Vite + React 19 + TypeScript
- Tailwind v4 (CSS-first config, no tailwind.config.js)
- React Router v7 (4 routes)
- TanStack Query v5 (30s stale time)

## Auth
API key from `VITE_RECTO_API_KEY` env var only. No auth screen, no localStorage. API failures show inline error states.

## Pages

### `/` — Timeline
- Paginated entry cards (title, date, tags, mood), newest first
- "Load more" button using cursor pagination
- Optional `?tag=` query param for filtering

### `/entry/:id` — Entry Detail
- Full content with prose typography
- Metadata: tags, mood, people, created date
- Media section if present
- Back button to timeline

### `/search` — Search
- Search input with mode toggle (hybrid/keyword/semantic)
- Results with highlights from API
- Click result navigates to entry detail

### `/tags` — Tag Browser
- List of tags
- Click tag navigates to `/?tag=<tag>`

## Layout
- Sidebar nav (Timeline, Search, Tags) + main content area
- Sidebar collapses to hamburger on mobile
- Warm neutral palette, calm journaling aesthetic
- Dark mode via `prefers-color-scheme` (Tailwind `dark:` variants)

## File Structure
```
packages/web/src/
  api/client.ts           — typed fetch wrapper
  api/queries.ts          — TanStack Query hooks
  components/Layout.tsx   — sidebar + main area
  components/EntryCard.tsx
  components/SearchBar.tsx
  components/TagBadge.tsx
  pages/Timeline.tsx
  pages/EntryDetail.tsx
  pages/Search.tsx
  pages/Tags.tsx
  main.tsx                — app root with providers
  index.css               — tailwind imports + theme
```

## Vite Config
- Dev proxy: `/api` -> `http://localhost:3000`
- Build: static files to `dist/`

## Decisions
- No tests for V1 web UI
- No auth screen — env var only
- TanStack Query for caching/loading states
- Dark mode from day one
