# Web UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal, read-only web UI for browsing journal entries with timeline, search, tags, and entry detail pages.

**Architecture:** Vite + React 19 SPA with React Router v7 for routing and TanStack Query v5 for data fetching. Tailwind v4 CSS-first config with dark mode. API key from env var only.

**Tech Stack:** React 19, Vite 6, Tailwind v4, React Router v7, TanStack Query v5, TypeScript

**Security note:** Search highlights use server-generated HTML from PostgreSQL `ts_headline` (not user input). The `dangerouslySetInnerHTML` usage in Search.tsx is safe — the HTML is generated server-side from our own API.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `packages/web/package.json`

**Step 1: Install runtime and dev dependencies**

Run:
```bash
cd /Users/kristijanstefanoski/Desktop/personal-workspace/recto
pnpm --filter @recto/web add react react-dom react-router @tanstack/react-query
pnpm --filter @recto/web add -D @types/react @types/react-dom tailwindcss @tailwindcss/typography @tailwindcss/vite @vitejs/plugin-react
```

**Step 2: Verify installs**

Run: `pnpm --filter @recto/web exec -- node -e "require('react/package.json').version"`
Expected: prints React version

**Step 3: Commit**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add React, Tailwind v4, React Router, TanStack Query"
```

---

### Task 2: Vite + Tailwind Config

**Files:**
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/src/index.css`
- Modify: `packages/web/src/main.tsx`

**Step 1: Create Vite config with Tailwind plugin and API proxy**

`packages/web/vite.config.ts`:
```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

**Step 2: Create index.css with Tailwind v4 imports**

`packages/web/src/index.css`:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --color-sand-50: #faf8f5;
  --color-sand-100: #f0ece5;
  --color-sand-200: #e0d9cc;
  --color-sand-300: #c9bfad;
  --color-sand-400: #b3a48e;
  --color-sand-500: #9d8a70;
  --color-sand-600: #7d6e5a;
  --color-sand-700: #5e5343;
  --color-sand-800: #3f382d;
  --color-sand-900: #1f1c16;
}

body {
  @apply bg-sand-50 text-sand-900 dark:bg-sand-900 dark:text-sand-50;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
```

**Step 3: Create minimal main.tsx to verify setup**

`packages/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function App() {
  return <div className="p-8 text-sand-700 dark:text-sand-200">Recto is loading...</div>;
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
```

**Step 4: Verify build works**

Run: `pnpm --filter @recto/web build`
Expected: successful build

**Step 5: Commit**

```bash
git add packages/web/vite.config.ts packages/web/src/index.css packages/web/src/main.tsx
git commit -m "feat(web): configure Vite with Tailwind v4 and API proxy"
```

---

### Task 3: API Client

**Files:**
- Create: `packages/web/src/api/client.ts`

**Step 1: Create typed API client**

The API returns entries matching the `Entry` type from `packages/api/src/db/schema.ts`. The web client defines its own types (no cross-package import).

`packages/web/src/api/client.ts`:
```typescript
export interface Entry {
  id: string;
  content: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  tags: string[] | null;
  mood: string | null;
  people: string[] | null;
  media: MediaItem[] | null;
  metadata: Record<string, unknown> | null;
}

export interface MediaItem {
  type: 'image' | 'audio' | 'video' | 'link';
  url: string;
  caption?: string;
}

export interface ListEntriesResponse {
  data: Entry[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface SearchResult {
  entry: Entry;
  score: number;
  highlights?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  mode_used: string;
  total: number;
}

export interface ListEntriesParams {
  limit?: number;
  cursor?: string;
  tag?: string;
  from?: string;
  to?: string;
}

export interface SearchParams {
  q: string;
  mode?: 'hybrid' | 'keyword' | 'semantic';
  limit?: number;
}

const API_KEY = import.meta.env.VITE_RECTO_API_KEY as string | undefined;
const BASE_URL = (import.meta.env.VITE_RECTO_API_URL as string | undefined) ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = (body as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new Error(`API error (${res.status}): ${msg}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  listEntries(params?: ListEntriesParams): Promise<ListEntriesResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString();
    return request<ListEntriesResponse>(`/entries${qs ? `?${qs}` : ''}`);
  },

  getEntry(id: string): Promise<Entry> {
    return request<Entry>(`/entries/${id}`);
  },

  search(params: SearchParams): Promise<SearchResponse> {
    const query = new URLSearchParams();
    query.set('q', params.q);
    if (params.mode) query.set('mode', params.mode);
    if (params.limit) query.set('limit', String(params.limit));
    return request<SearchResponse>(`/search?${query.toString()}`);
  },
};
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @recto/web typecheck`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/web/src/api/client.ts
git commit -m "feat(web): add typed API client"
```

---

### Task 4: TanStack Query Hooks

**Files:**
- Create: `packages/web/src/api/queries.ts`

**Step 1: Create query hooks**

`packages/web/src/api/queries.ts`:
```typescript
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { ListEntriesParams } from './client';

const STALE_TIME = 30_000;

export function useEntries(params?: Omit<ListEntriesParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: ['entries', params],
    queryFn: ({ pageParam }) => api.listEntries({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined),
    staleTime: STALE_TIME,
  });
}

export function useEntry(id: string) {
  return useQuery({
    queryKey: ['entry', id],
    queryFn: () => api.getEntry(id),
    staleTime: STALE_TIME,
  });
}

export function useSearch(query: string, mode?: 'hybrid' | 'keyword' | 'semantic') {
  return useQuery({
    queryKey: ['search', query, mode],
    queryFn: () => api.search({ q: query, mode }),
    enabled: query.length > 0,
    staleTime: STALE_TIME,
  });
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @recto/web typecheck`

**Step 3: Commit**

```bash
git add packages/web/src/api/queries.ts
git commit -m "feat(web): add TanStack Query hooks for entries, search"
```

---

### Task 5: Layout Component

**Files:**
- Create: `packages/web/src/components/Layout.tsx`

**Step 1: Create Layout with sidebar nav and responsive hamburger**

`packages/web/src/components/Layout.tsx`:
```tsx
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

const NAV_ITEMS = [
  { to: '/', label: 'Timeline', icon: '\u25A1' },
  { to: '/search', label: 'Search', icon: '\u25CB' },
  { to: '/tags', label: 'Tags', icon: '#' },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-sand-200 dark:bg-sand-800"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation"
      >
        <span className="block w-5 h-0.5 bg-sand-700 dark:bg-sand-200 mb-1" />
        <span className="block w-5 h-0.5 bg-sand-700 dark:bg-sand-200 mb-1" />
        <span className="block w-5 h-0.5 bg-sand-700 dark:bg-sand-200" />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={() => {}}
          role="presentation"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-56 bg-sand-100 dark:bg-sand-800 border-r border-sand-200 dark:border-sand-700 p-6 flex flex-col transition-transform md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <h1 className="text-xl font-semibold mb-8 text-sand-800 dark:text-sand-100">recto</h1>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-sand-200 dark:bg-sand-700 text-sand-900 dark:text-sand-50 font-medium'
                    : 'text-sand-600 dark:text-sand-400 hover:bg-sand-200/50 dark:hover:bg-sand-700/50'
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-6 md:p-10 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @recto/web typecheck`

**Step 3: Commit**

```bash
git add packages/web/src/components/Layout.tsx
git commit -m "feat(web): add Layout component with responsive sidebar"
```

---

### Task 6: Shared Components (EntryCard, TagBadge)

**Files:**
- Create: `packages/web/src/components/EntryCard.tsx`
- Create: `packages/web/src/components/TagBadge.tsx`

**Step 1: Create TagBadge**

`packages/web/src/components/TagBadge.tsx`:
```tsx
import { Link } from 'react-router';

export function TagBadge({ tag }: { tag: string }) {
  return (
    <Link
      to={`/?tag=${encodeURIComponent(tag)}`}
      className="inline-block px-2 py-0.5 text-xs rounded-full bg-sand-200 dark:bg-sand-700 text-sand-700 dark:text-sand-300 hover:bg-sand-300 dark:hover:bg-sand-600 transition-colors"
    >
      {tag}
    </Link>
  );
}
```

**Step 2: Create EntryCard**

`packages/web/src/components/EntryCard.tsx`:
```tsx
import { Link } from 'react-router';
import type { Entry } from '../api/client';
import { TagBadge } from './TagBadge';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function EntryCard({ entry }: { entry: Entry }) {
  const title = entry.title ?? entry.content.slice(0, 80) + (entry.content.length > 80 ? '...' : '');
  const snippet = entry.content.length > 200 ? entry.content.slice(0, 200) + '...' : entry.content;

  return (
    <Link
      to={`/entry/${entry.id}`}
      className="block p-5 rounded-xl border border-sand-200 dark:border-sand-700 hover:border-sand-300 dark:hover:border-sand-600 bg-white dark:bg-sand-800 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-medium text-sand-800 dark:text-sand-100 line-clamp-1">{title}</h3>
        {entry.mood && (
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-sand-100 dark:bg-sand-700 text-sand-600 dark:text-sand-300">
            {entry.mood}
          </span>
        )}
      </div>
      <p className="text-sm text-sand-600 dark:text-sand-400 mb-3 line-clamp-2">{snippet}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <time className="text-xs text-sand-500 dark:text-sand-500">{formatDate(entry.created_at)}</time>
        {entry.tags?.map((tag) => <TagBadge key={tag} tag={tag} />)}
      </div>
    </Link>
  );
}
```

**Step 3: Verify typecheck**

Run: `pnpm --filter @recto/web typecheck`

**Step 4: Commit**

```bash
git add packages/web/src/components/EntryCard.tsx packages/web/src/components/TagBadge.tsx
git commit -m "feat(web): add EntryCard and TagBadge components"
```

---

### Task 7: Timeline Page

**Files:**
- Create: `packages/web/src/pages/Timeline.tsx`

**Step 1: Create Timeline page with infinite loading**

`packages/web/src/pages/Timeline.tsx`:
```tsx
import { useSearchParams } from 'react-router';
import { useEntries } from '../api/queries';
import { EntryCard } from '../components/EntryCard';

export function Timeline() {
  const [searchParams] = useSearchParams();
  const tag = searchParams.get('tag') ?? undefined;
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useEntries({ tag, limit: 10 });

  const entries = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-semibold text-sand-800 dark:text-sand-100">
          {tag ? `#${tag}` : 'Timeline'}
        </h2>
        {tag && (
          <a href="/" className="text-sm text-sand-500 hover:text-sand-700 dark:hover:text-sand-300">
            clear filter
          </a>
        )}
      </div>

      {isLoading && <p className="text-sand-500">Loading entries...</p>}
      {isError && <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>}

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>

      {entries.length === 0 && !isLoading && (
        <p className="text-sand-500 text-center py-12">No entries yet.</p>
      )}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-6 w-full py-2 text-sm text-sand-600 dark:text-sand-400 border border-sand-200 dark:border-sand-700 rounded-lg hover:bg-sand-100 dark:hover:bg-sand-800 transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @recto/web typecheck`

**Step 3: Commit**

```bash
git add packages/web/src/pages/Timeline.tsx
git commit -m "feat(web): add Timeline page with cursor pagination"
```

---

### Task 8: Entry Detail Page

**Files:**
- Create: `packages/web/src/pages/EntryDetail.tsx`

**Step 1: Create entry detail page**

`packages/web/src/pages/EntryDetail.tsx`:
```tsx
import { useNavigate, useParams } from 'react-router';
import { useEntry } from '../api/queries';
import { TagBadge } from '../components/TagBadge';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function EntryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading, isError, error } = useEntry(id!);

  if (isLoading) return <p className="text-sand-500">Loading...</p>;
  if (isError) return <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>;
  if (!entry) return <p className="text-sand-500">Entry not found.</p>;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm text-sand-500 hover:text-sand-700 dark:hover:text-sand-300 mb-6 inline-block"
      >
        &larr; Back
      </button>

      <article>
        <h1 className="text-2xl font-semibold text-sand-800 dark:text-sand-100 mb-2">
          {entry.title ?? 'Untitled'}
        </h1>

        <time className="text-sm text-sand-500 block mb-4">{formatDate(entry.created_at)}</time>

        {/* Metadata */}
        <div className="flex items-center gap-3 flex-wrap mb-6">
          {entry.mood && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-sand-200 dark:bg-sand-700 text-sand-600 dark:text-sand-300">
              {entry.mood}
            </span>
          )}
          {entry.tags?.map((tag) => <TagBadge key={tag} tag={tag} />)}
          {entry.people?.map((person) => (
            <span
              key={person}
              className="text-xs px-2 py-0.5 rounded-full bg-sand-100 dark:bg-sand-700 text-sand-600 dark:text-sand-300"
            >
              @{person}
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="prose prose-sand dark:prose-invert max-w-none">
          {entry.content.split('\n').map((line, i) => (
            <p key={i}>{line || '\u00A0'}</p>
          ))}
        </div>

        {/* Media */}
        {entry.media && entry.media.length > 0 && (
          <div className="mt-8 border-t border-sand-200 dark:border-sand-700 pt-6">
            <h2 className="text-sm font-medium text-sand-600 dark:text-sand-400 mb-3">Media</h2>
            <div className="flex flex-col gap-3">
              {entry.media.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs uppercase text-sand-500">{item.type}</span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sand-700 dark:text-sand-300 underline truncate"
                  >
                    {item.caption ?? item.url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @recto/web typecheck`

**Step 3: Commit**

```bash
git add packages/web/src/pages/EntryDetail.tsx
git commit -m "feat(web): add Entry detail page with metadata and media"
```

---

### Task 9: Search Page

**Files:**
- Create: `packages/web/src/pages/Search.tsx`

**Step 1: Create search page with mode toggle**

Note: Search highlights come from PostgreSQL `ts_headline` — server-generated HTML, safe to render.

`packages/web/src/pages/Search.tsx`:
```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { useSearch } from '../api/queries';
import { TagBadge } from '../components/TagBadge';

const MODES = ['hybrid', 'keyword', 'semantic'] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function Search() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<(typeof MODES)[number]>('hybrid');

  const { data, isLoading, isError, error } = useSearch(query, mode);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(input.trim());
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-sand-800 dark:text-sand-100 mb-6">Search</h2>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search your journal..."
            className="flex-1 px-4 py-2 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-900 dark:text-sand-100 placeholder:text-sand-400 focus:outline-none focus:ring-2 focus:ring-sand-300 dark:focus:ring-sand-600"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-sand-700 dark:bg-sand-200 text-white dark:text-sand-900 text-sm font-medium hover:bg-sand-800 dark:hover:bg-sand-100 transition-colors"
          >
            Search
          </button>
        </div>

        <div className="flex gap-1 mt-3">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                if (query) setQuery(input.trim());
              }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                mode === m
                  ? 'bg-sand-700 dark:bg-sand-200 text-white dark:text-sand-900'
                  : 'bg-sand-100 dark:bg-sand-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-sand-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </form>

      {isLoading && <p className="text-sand-500">Searching...</p>}
      {isError && <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>}

      {data && (
        <p className="text-sm text-sand-500 mb-4">
          {data.total} result{data.total !== 1 ? 's' : ''} (mode: {data.mode_used})
        </p>
      )}

      <div className="flex flex-col gap-3">
        {data?.results.map((r) => (
          <Link
            key={r.entry.id}
            to={`/entry/${r.entry.id}`}
            className="block p-5 rounded-xl border border-sand-200 dark:border-sand-700 hover:border-sand-300 dark:hover:border-sand-600 bg-white dark:bg-sand-800 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-medium text-sand-800 dark:text-sand-100">
                {r.entry.title ?? 'Untitled'}
              </h3>
              <time className="text-xs text-sand-500 shrink-0">
                {formatDate(r.entry.created_at)}
              </time>
            </div>
            {r.highlights?.[0] && (
              <p
                className="text-sm text-sand-600 dark:text-sand-400 mb-2 [&_mark]:bg-sand-300 dark:[&_mark]:bg-sand-600 [&_mark]:rounded [&_mark]:px-0.5"
                dangerouslySetInnerHTML={{ __html: r.highlights[0] }}
              />
            )}
            <div className="flex items-center gap-2">
              {r.entry.tags?.map((tag) => <TagBadge key={tag} tag={tag} />)}
            </div>
          </Link>
        ))}
      </div>

      {query && data && data.results.length === 0 && (
        <p className="text-sand-500 text-center py-12">No results found.</p>
      )}
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @recto/web typecheck`

**Step 3: Commit**

```bash
git add packages/web/src/pages/Search.tsx
git commit -m "feat(web): add Search page with mode toggle and highlights"
```

---

### Task 10: Tags Page

**Files:**
- Create: `packages/web/src/pages/Tags.tsx`

**Step 1: Create Tags page**

The API doesn't have a dedicated tags endpoint, so we fetch recent entries and aggregate tags client-side.

`packages/web/src/pages/Tags.tsx`:
```tsx
import { Link } from 'react-router';
import { useEntries } from '../api/queries';

export function Tags() {
  const { data, isLoading, isError, error } = useEntries({ limit: 100 });

  const entries = data?.pages.flatMap((p) => p.data) ?? [];
  const tagCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-sand-800 dark:text-sand-100 mb-6">Tags</h2>

      {isLoading && <p className="text-sand-500">Loading...</p>}
      {isError && <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>}

      {sorted.length === 0 && !isLoading && (
        <p className="text-sand-500 text-center py-12">No tags found.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {sorted.map(([tag, count]) => (
          <Link
            key={tag}
            to={`/?tag=${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-700 dark:text-sand-300 hover:border-sand-300 dark:hover:border-sand-600 transition-colors"
          >
            <span className="text-sm">#{tag}</span>
            <span className="text-xs text-sand-400">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @recto/web typecheck`

**Step 3: Commit**

```bash
git add packages/web/src/pages/Tags.tsx
git commit -m "feat(web): add Tags page with entry counts"
```

---

### Task 11: Wire Up Router and Providers in main.tsx

**Files:**
- Modify: `packages/web/src/main.tsx`

**Step 1: Update main.tsx with router, query client, and all pages**

`packages/web/src/main.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { EntryDetail } from './pages/EntryDetail';
import { Search } from './pages/Search';
import { Tags } from './pages/Tags';
import { Timeline } from './pages/Timeline';
import './index.css';

const queryClient = new QueryClient();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Timeline />} />
              <Route path="entry/:id" element={<EntryDetail />} />
              <Route path="search" element={<Search />} />
              <Route path="tags" element={<Tags />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
```

**Step 2: Verify typecheck and build**

Run:
```bash
pnpm --filter @recto/web typecheck && pnpm --filter @recto/web build
```
Expected: no errors, successful build

**Step 3: Run lint**

Run: `pnpm biome check --write packages/web/src`

**Step 4: Commit**

```bash
git add packages/web/src/main.tsx
git commit -m "feat(web): wire up router with all pages and providers"
```

---

### Task 12: Final Verification and PROGRESS.md Update

**Step 1: Run full pipeline**

```bash
pnpm --filter @recto/web typecheck
pnpm --filter @recto/web build
pnpm biome check packages/web/src
```

**Step 2: Update PROGRESS.md**

Mark Plan 07 items as done with date `2026-03-06`.

**Step 3: Final commit**

```bash
git add local-docs/plans/PROGRESS.md
git commit -m "docs: mark Plan 07 (Web UI) as done"
```
