# V1 Release Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring Recto to production-quality standards through security hardening, code quality improvements, and documentation accuracy — package by package.

**Architecture:** Bottom-up review: `@recto/api` (foundation) → `@recto/mcp` → `@recto/web` → docs. Each phase extracts shared utilities, eliminates duplication, adds constants/enums, fixes security gaps, and updates tests.

**Tech Stack:** TypeScript (strict), Hono, Drizzle ORM, MCP SDK, React, Vitest, Biome

---

## Phase 1: @recto/api — Constants, Utilities & Security

### Task 1: Extract API Constants

**Files:**
- Create: `packages/api/src/constants.ts`
- Modify: `packages/api/src/config.ts`
- Modify: `packages/api/src/routes/reflect.ts`
- Modify: `packages/api/src/routes/search.ts`
- Modify: `packages/api/src/routes/oauth.ts`
- Modify: `packages/api/src/services/llm.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/src/routes/system.ts`

**Step 1: Create constants file**

Create `packages/api/src/constants.ts` with all magic numbers/strings extracted from the codebase:

```typescript
// --- Auth ---
export const MIN_API_KEY_LENGTH = 32;

// --- Pagination ---
export const DEFAULT_PAGE_LIMIT = 20;

// --- Search ---
export const SEARCH_DEFAULT_LIMIT = 20;
export const RRF_K = 60;

// --- Reflect ---
export const REFLECT_DEFAULT_LIMIT = 20;
export const MAX_CONTEXT_CHARS = 16_000;
export const MAX_ENTRY_WORDS = 500;

// --- OAuth ---
export const AUTH_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const OAUTH_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// --- LLM ---
export const LLM_MAX_TOKENS_ENRICHMENT = 512;
export const LLM_MAX_TOKENS_REFLECT = 1024;

// --- Embedding Dimensions ---
export const EMBEDDING_DIMENSIONS = {
  openai: 1536,
  voyageai: 1024,
  ollama: 768,
} as const;

// --- Error Codes ---
export const ERROR_CODE = {
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// --- HTTP Status ---
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
```

**Step 2: Replace magic numbers across route files**

Update all route files to import and use constants instead of hardcoded values:

- `reflect.ts`: Replace `16000` → `MAX_CONTEXT_CHARS`, `500` → `MAX_ENTRY_WORDS`, `20` → `REFLECT_DEFAULT_LIMIT`
- `search.ts`: Replace `20` → `SEARCH_DEFAULT_LIMIT`
- `oauth.ts`: Replace `10 * 60 * 1000` → `AUTH_CODE_EXPIRY_MS`
- `index.ts`: Replace `60 * 60 * 1000` → `OAUTH_CLEANUP_INTERVAL_MS`
- `config.ts`: Replace inline `{ openai: 1536, ... }` → import `EMBEDDING_DIMENSIONS`
- `llm.ts`: Replace `512` → `LLM_MAX_TOKENS_ENRICHMENT`, `1024` → `LLM_MAX_TOKENS_REFLECT`
- `system.ts`: Read version from `package.json` instead of hardcoded `'0.1.0'`

**Step 3: Replace magic error strings with ERROR_CODE constants**

Update all `c.json({ error: { code: '...' } })` calls to use `ERROR_CODE.*` constants.

**Step 4: Run tests to verify nothing broke**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/api/src/constants.ts packages/api/src/
git commit -m "refactor(api): extract magic numbers and strings into constants"
```

---

### Task 2: Extract Shared Error Response Utilities

**Files:**
- Create: `packages/api/src/lib/responses.ts`
- Modify: `packages/api/src/routes/entries.ts`
- Modify: `packages/api/src/routes/tags.ts`
- Modify: `packages/api/src/routes/media.ts`
- Modify: `packages/api/src/routes/reflect.ts`
- Modify: `packages/api/src/routes/search.ts`
- Modify: `packages/api/src/routes/instructions.ts`
- Modify: `packages/api/src/routes/prompts.ts`

**Step 1: Create response utilities**

Create `packages/api/src/lib/responses.ts`:

```typescript
import type { Context } from 'hono';
import { ERROR_CODE, HTTP_STATUS } from '../constants.js';

export function notFound(c: Context, message: string) {
  return c.json({ error: { code: ERROR_CODE.NOT_FOUND, message } }, HTTP_STATUS.NOT_FOUND);
}

export function badRequest(c: Context, message: string) {
  return c.json({ error: { code: ERROR_CODE.BAD_REQUEST, message } }, HTTP_STATUS.BAD_REQUEST);
}

export function conflict(c: Context, message: string) {
  return c.json({ error: { code: ERROR_CODE.CONFLICT, message } }, HTTP_STATUS.CONFLICT);
}

export function serviceUnavailable(c: Context, message: string) {
  return c.json(
    { error: { code: ERROR_CODE.SERVICE_UNAVAILABLE, message } },
    HTTP_STATUS.SERVICE_UNAVAILABLE,
  );
}
```

**Step 2: Replace all inline error responses across routes**

Every `c.json({ error: { code: 'NOT_FOUND', message: '...' } }, 404)` becomes `notFound(c, '...')`, and similarly for other error types. This affects 6+ route files with 15+ occurrences.

**Step 3: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/api/src/lib/responses.ts packages/api/src/routes/
git commit -m "refactor(api): extract shared error response utilities"
```

---

### Task 3: Extract Shared Database Helpers

**Files:**
- Create: `packages/api/src/lib/db-helpers.ts`
- Modify: `packages/api/src/routes/entries.ts`
- Modify: `packages/api/src/routes/tags.ts`
- Modify: `packages/api/src/routes/media.ts`

**Step 1: Create database helpers**

Create `packages/api/src/lib/db-helpers.ts`:

```typescript
import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection.js';
import { entries } from '../db/schema.js';

export async function findEntryById(db: Database, id: string) {
  const [entry] = await db.select().from(entries).where(eq(entries.id, id));
  return entry ?? null;
}
```

**Step 2: Replace duplicated entry lookups**

Replace the repeated pattern across `entries.ts`, `tags.ts`, and `media.ts`:
```typescript
// Before (duplicated 6+ times):
const [entry] = await db.select().from(entries).where(eq(entries.id, id));
if (!entry) { return c.json({ error: ... }, 404); }

// After:
const entry = await findEntryById(db, id);
if (!entry) return notFound(c, 'Entry not found');
```

**Step 3: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/api/src/lib/db-helpers.ts packages/api/src/routes/
git commit -m "refactor(api): extract shared database helper for entry lookups"
```

---

### Task 4: Deduplicate timingSafeEqual

**Files:**
- Create: `packages/api/src/lib/crypto.ts`
- Modify: `packages/api/src/middleware/auth.ts`
- Modify: `packages/api/src/services/oauth.ts`

**Step 1: Create shared crypto utility**

Create `packages/api/src/lib/crypto.ts`:

```typescript
import { timingSafeEqual } from 'node:crypto';

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

**Step 2: Update auth.ts and oauth.ts to import from shared module**

Remove the duplicated `safeEqual` function from both files, import from `../lib/crypto.js`.

**Step 3: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/api/src/lib/crypto.ts packages/api/src/middleware/auth.ts packages/api/src/services/oauth.ts
git commit -m "refactor(api): deduplicate timingSafeEqual into shared crypto utility"
```

---

### Task 5: Enforce Minimum API Key Length

**Files:**
- Modify: `packages/api/src/config.ts`
- Modify: `packages/api/src/__tests__/config.test.ts` (or create if needed)

**Step 1: Update Zod schema**

In `config.ts`, change the `RECTO_API_KEY` validation:

```typescript
// Before:
RECTO_API_KEY: z.string().min(1),

// After:
RECTO_API_KEY: z.string().min(MIN_API_KEY_LENGTH, {
  message: `API key must be at least ${MIN_API_KEY_LENGTH} characters`,
}),
```

Import `MIN_API_KEY_LENGTH` from `../constants.js`.

**Step 2: Update .env.example**

Change the example key to a 32+ character value:

```
RECTO_API_KEY=change-me-to-a-secret-key-at-least-32-chars
```

**Step 3: Write test for minimum length enforcement**

Add a test verifying the config rejects keys shorter than 32 characters.

**Step 4: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass (existing tests may need API key values updated to 32+ chars)

**Step 5: Commit**

```bash
git add packages/api/src/config.ts .env.example packages/api/src/__tests__/
git commit -m "feat(api): enforce minimum 32-character API key at startup"
```

---

### Task 6: Add UUID Validation on ID Parameters

**Files:**
- Modify: `packages/api/src/types.ts`
- Modify: `packages/api/src/routes/entries.ts`
- Modify: `packages/api/src/routes/tags.ts`
- Modify: `packages/api/src/routes/media.ts`
- Modify: `packages/api/src/routes/prompts.ts`

**Step 1: Add UUID validation schema**

In `types.ts`, add:

```typescript
export const uuidParam = z.string().uuid('Invalid UUID format');
```

**Step 2: Add validation to all routes that accept ID params**

Create a reusable helper or use Hono's `zValidator` on param:

```typescript
// In route handlers that use c.req.param('id'):
const id = c.req.param('id');
const parsed = uuidParam.safeParse(id);
if (!parsed.success) return badRequest(c, 'Invalid ID format');
```

Apply to: `entries.ts` (GET/PATCH/DELETE /:id), `tags.ts` (POST/DELETE /:id/tags), `media.ts` (POST/DELETE /:id/media), `prompts.ts` (PUT/DELETE /:id).

**Step 3: Write test for invalid UUID rejection**

Add a test that sends a non-UUID string as ID and expects 400 response.

**Step 4: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/api/src/types.ts packages/api/src/routes/ packages/api/src/__tests__/
git commit -m "feat(api): validate UUID format on all ID parameters"
```

---

### Task 7: Harden External API Calls (LLM & Embedding)

**Files:**
- Modify: `packages/api/src/services/embedding.ts`
- Modify: `packages/api/src/services/llm.ts`

**Step 1: Add try-catch around fetch calls in embedding providers**

Wrap each provider's `embed()` method in try-catch to handle network errors gracefully:

```typescript
async embed(text: string): Promise<number[]> {
  try {
    const res = await fetch(this.url, { ... });
    if (!res.ok) {
      throw new Error(`Embedding API error: ${res.status} ${res.statusText}`);
    }
    const body = await res.json();
    return body.data[0].embedding;
  } catch (error) {
    logger.error('Embedding failed', { provider: 'openai', error: String(error) });
    throw error;
  }
}
```

Apply to all 3 embedding providers (OpenAI, VoyageAI, Ollama) and both LLM providers (Anthropic, OpenAI).

**Step 2: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/api/src/services/embedding.ts packages/api/src/services/llm.ts
git commit -m "fix(api): add error handling for external API calls in LLM and embedding providers"
```

---

### Task 8: Fix Unsafe Type Casts in Search Service

**Files:**
- Modify: `packages/api/src/services/search.ts`
- Create or modify: `packages/api/src/types.ts` (add search result types)

**Step 1: Define proper types for search results**

In `types.ts`, add typed interfaces for raw SQL search results:

```typescript
export interface RawSearchResult {
  id: string;
  content: string;
  title: string | null;
  tags: string[] | null;
  mood: string | null;
  people: string[] | null;
  media: unknown[] | null;
  embedding: unknown;
  created_at: Date;
  updated_at: Date;
  rank: number;
  highlights: string;
}
```

**Step 2: Replace unsafe casts in search.ts**

Replace `as Record<string, unknown>[]` and `as Entry[]` with proper typed interfaces.

**Step 3: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/api/src/services/search.ts packages/api/src/types.ts
git commit -m "refactor(api): replace unsafe type casts in search service with proper types"
```

---

### Task 9: Consistent Response Structure Across Routes

**Files:**
- Modify: `packages/api/src/routes/entries.ts`
- Modify: `packages/api/src/routes/tags.ts`
- Modify: `packages/api/src/routes/search.ts`
- Modify: `packages/api/src/routes/instructions.ts`
- Modify: `packages/api/src/routes/prompts.ts`
- Update: related test files

**Step 1: Audit and document current response shapes**

Review all routes and ensure consistent patterns:
- **Single resource**: `{ data: <resource> }` (not bare resource at top level)
- **List**: `{ data: [...], next_cursor?, has_more? }`
- **Create**: HTTP 201 + `{ data: <resource> }`
- **Update**: HTTP 200 + `{ data: <resource> }`
- **Delete**: HTTP 200 + `{ message: '...' }`

**Step 2: Fix any routes that return inconsistent shapes**

Ensure all routes follow the documented pattern. For search: `{ data: { results, mode_used, total } }` or keep the current flat shape if it's already documented in the API contract.

Review carefully — this is a breaking change if clients depend on current shapes. Only fix genuinely inconsistent routes, don't restructure working APIs.

**Step 3: Update tests for any response shape changes**

**Step 4: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/api/src/routes/ packages/api/src/__tests__/
git commit -m "refactor(api): normalize response structure across all routes"
```

---

### Task 10: Improve Structured Logging

**Files:**
- Modify: `packages/api/src/lib/logger.ts`
- Modify: `packages/api/src/app.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/src/services/enrichment.ts`

**Step 1: Review current logger and add request context**

Ensure the logger is used consistently:
- Replace any `console.log` / `console.error` calls with `logger.info` / `logger.error`
- Add structured context to log calls (e.g., `{ route, method, entryId }`)
- Log OAuth cleanup results
- Log enrichment success/failure with entry ID

**Step 2: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/api/src/
git commit -m "refactor(api): improve structured logging consistency"
```

---

### Task 11: Review & Clean Up OAuth Routes

**Files:**
- Modify: `packages/api/src/routes/oauth.ts`
- Modify: `packages/api/src/services/oauth.ts`

**Step 1: Extract duplicated client secret validation**

The confidential client validation pattern appears twice in `oauth.ts` (around lines 303-317 and 402-416). Extract to a shared helper.

**Step 2: Tighten OAuth state validation**

Ensure the state parameter is validated across the authorize → token exchange flow. Add validation that state from form POST matches the expected format.

**Step 3: Fix null reference risk**

Add null check before accessing `oauthClient.tokenEndpointAuthMethod` around line 303.

**Step 4: Use constants for OAuth-specific values**

Replace hardcoded token generation byte lengths, expiry times, etc. with constants from `constants.ts`.

**Step 5: Run tests**

Run: `cd packages/api && pnpm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/api/src/routes/oauth.ts packages/api/src/services/oauth.ts
git commit -m "refactor(api): clean up OAuth routes — extract duplication, fix null reference risk"
```

---

## Phase 2: @recto/mcp — Types, Error Handling & Constants

### Task 12: Define Shared Types for MCP Package

**Files:**
- Create: `packages/mcp/src/types.ts`
- Modify: `packages/mcp/src/client.ts`
- Modify: `packages/mcp/src/server.ts`

**Step 1: Create types file**

Create `packages/mcp/src/types.ts` with proper interfaces instead of `Record<string, unknown>`:

```typescript
export interface JournalEntry {
  id: string;
  content: string;
  title: string | null;
  tags: string[] | null;
  mood: string | null;
  people: string[] | null;
  media: Array<{ type: string; url: string; caption?: string }> | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface SearchResult {
  entry: JournalEntry;
  score: number;
  highlights?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  mode_used: string;
  total: number;
}

export interface ReflectResponse {
  reflection: string;
  entries_used: Array<{ id: string; title: string | null; created_at: string }>;
  period: { from: string; to: string };
}

export interface Prompt {
  id: string;
  name: string;
  description: string;
  content: string;
  is_default: boolean;
}
```

**Step 2: Update client.ts to use proper types**

Replace all `Record<string, unknown>` return types with the new interfaces.

**Step 3: Update server.ts to use typed entry**

Change `formatEntry(entry: Record<string, unknown>)` to `formatEntry(entry: JournalEntry)`. Remove unsafe `as string` casts.

**Step 4: Run tests**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/mcp/src/types.ts packages/mcp/src/client.ts packages/mcp/src/server.ts
git commit -m "refactor(mcp): define proper TypeScript types, replace Record<string, unknown>"
```

---

### Task 13: Extract MCP Constants & Helpers

**Files:**
- Create: `packages/mcp/src/constants.ts`
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/mcp/src/server.ts`

**Step 1: Create constants file**

```typescript
export const MCP_SERVER_NAME = 'recto';
export const MCP_DEFAULT_PORT = 3001;
export const INSTRUCTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
export const ENTRY_SNIPPET_LENGTH = 200;
export const DEFAULT_LIST_LIMIT = 10;
export const DATE_LOCALE = 'en-US';

export const JSON_RPC_ERROR_CODE = -32000;

export const PROMPT_NAMES = [
  'daily-checkin',
  'weekly-review',
  'monthly-retrospective',
  'gratitude',
  'idea-capture',
  'goal-setting',
] as const;
```

**Step 2: Extract text response helper in server.ts**

```typescript
function textResponse(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
```

Replace 11 instances of `{ content: [{ type: 'text' as const, text: ... }] }`.

**Step 3: Extract JSON-RPC error helper in index.ts**

```typescript
function jsonRpcError(message: string) {
  return JSON.stringify({
    jsonrpc: '2.0',
    error: { code: JSON_RPC_ERROR_CODE, message },
    id: null,
  });
}
```

Replace 2 duplicated error response objects + fix the inconsistent plain-text 404 response.

**Step 4: Replace all magic numbers with constants**

**Step 5: Run tests**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/mcp/src/constants.ts packages/mcp/src/index.ts packages/mcp/src/server.ts
git commit -m "refactor(mcp): extract constants and helper functions, eliminate magic strings"
```

---

### Task 14: Add Error Handling to MCP Tool Handlers

**Files:**
- Modify: `packages/mcp/src/server.ts`
- Modify: `packages/mcp/src/index.ts`

**Step 1: Wrap all tool handlers in try-catch**

Each tool handler should catch errors and return a user-friendly error response instead of crashing:

```typescript
async (args) => {
  try {
    const entry = await client.createEntry(args);
    return textResponse(`Journal entry created (ID: ${entry.id}).\n\n${formatEntry(entry)}`);
  } catch (error) {
    return textResponse(`Failed to create entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

Apply to all 8 tool handlers.

**Step 2: Add error handling for instructions fetch**

Wrap `getInstructions()` call in `index.ts` in try-catch with fallback to empty instructions.

**Step 3: Add error handling for invalid JSON responses**

In `client.ts`, wrap `res.json()` in try-catch to handle non-JSON responses.

**Step 4: Run tests**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/src/index.ts packages/mcp/src/client.ts
git commit -m "fix(mcp): add error handling to all tool handlers and instructions fetch"
```

---

### Task 15: Add MCP Health Check Endpoint

**Files:**
- Modify: `packages/mcp/src/index.ts`

**Step 1: Add /health endpoint**

In the HTTP server handler, add a health check route before the MCP handler:

```typescript
if (req.url === '/health' && req.method === 'GET') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
  return;
}
```

This should be placed before the auth check so it's accessible without authentication.

**Step 2: Update MCP Dockerfile health check**

Add `HEALTHCHECK` instruction to `packages/mcp/Dockerfile`:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1))"
```

**Step 3: Update docker-compose.yml**

Add health check for MCP service to match API service pattern.

**Step 4: Run tests**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/mcp/src/index.ts packages/mcp/Dockerfile docker-compose.yml
git commit -m "feat(mcp): add /health endpoint for container orchestration"
```

---

### Task 16: Read MCP Version from package.json

**Files:**
- Modify: `packages/mcp/src/server.ts`

**Step 1: Import version from package.json**

Replace hardcoded `'0.1.0'` version string:

```typescript
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

// In createMcpServer:
const server = new McpServer({ name: MCP_SERVER_NAME, version: pkg.version }, { instructions });
```

Or use a simpler approach with `createRequire` if available, or pass version as a parameter.

**Step 2: Run tests**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/mcp/src/server.ts
git commit -m "refactor(mcp): read version from package.json instead of hardcoded string"
```

---

## Phase 3: @recto/web — DRY, Types & Consistency

### Task 17: Extract Web Constants and Date Utilities

**Files:**
- Create: `packages/web/src/constants.ts`
- Create: `packages/web/src/lib/format.ts`
- Modify: `packages/web/src/components/EntryCard.tsx`
- Modify: `packages/web/src/components/EntryDetail.tsx`
- Modify: `packages/web/src/pages/Search.tsx`

**Step 1: Create constants file**

```typescript
// --- Feedback ---
export const FEEDBACK_DISMISS_MS = 3000;

// --- Pagination ---
export const TIMELINE_PAGE_LIMIT = 10;
export const TAGS_ENTRY_LIMIT = 100;

// --- Content Truncation ---
export const TITLE_PREVIEW_LENGTH = 80;
export const SNIPPET_PREVIEW_LENGTH = 200;

// --- Search Modes ---
export const SEARCH_MODES = ['hybrid', 'keyword', 'semantic'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

// --- Settings Tabs ---
export const SETTINGS_TABS = ['Instructions', 'Prompts'] as const;
```

**Step 2: Create date formatting utility**

Create `packages/web/src/lib/format.ts`:

```typescript
const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', SHORT_DATE_OPTIONS);
}

export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', LONG_DATE_OPTIONS);
}
```

**Step 3: Replace duplicated formatDate functions**

Update `EntryCard.tsx`, `EntryDetail.tsx`, and `Search.tsx` to import from `lib/format.ts`.

**Step 4: Replace magic numbers with constants**

**Step 5: Run build to verify**

Run: `cd packages/web && pnpm build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add packages/web/src/constants.ts packages/web/src/lib/format.ts packages/web/src/components/ packages/web/src/pages/
git commit -m "refactor(web): extract date formatting utilities and constants"
```

---

### Task 18: Extract Custom Hooks (useFeedback, useAutoResize)

**Files:**
- Create: `packages/web/src/hooks/useFeedback.ts`
- Create: `packages/web/src/hooks/useAutoResizeTextarea.ts`
- Modify: `packages/web/src/components/InstructionsEditor.tsx`
- Modify: `packages/web/src/components/PromptCard.tsx`
- Modify: `packages/web/src/components/PromptList.tsx`
- Modify: `packages/web/src/components/PromptForm.tsx`

**Step 1: Create useFeedback hook**

```typescript
import { useEffect, useState } from 'react';
import { FEEDBACK_DISMISS_MS } from '../constants';

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

export function useFeedback(dismissMs = FEEDBACK_DISMISS_MS) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), dismissMs);
      return () => clearTimeout(timer);
    }
  }, [feedback, dismissMs]);

  return { feedback, setFeedback };
}
```

**Step 2: Create useAutoResizeTextarea hook**

```typescript
import { useEffect, type RefObject } from 'react';

export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  dependency: string,
) {
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [ref, dependency]);
}
```

**Step 3: Replace duplicated patterns in components**

Update `InstructionsEditor.tsx`, `PromptCard.tsx`, `PromptList.tsx` to use `useFeedback()`.
Update `PromptForm.tsx` and `InstructionsEditor.tsx` to use `useAutoResizeTextarea()`.

**Step 4: Run build to verify**

Run: `cd packages/web && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/web/src/hooks/ packages/web/src/components/
git commit -m "refactor(web): extract useFeedback and useAutoResizeTextarea hooks"
```

---

### Task 19: Extract Reusable UI Components

**Files:**
- Create: `packages/web/src/components/ErrorMessage.tsx`
- Create: `packages/web/src/components/FeedbackBanner.tsx`
- Modify: Various page and component files

**Step 1: Create ErrorMessage component**

```typescript
interface ErrorMessageProps {
  error: Error;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return (
    <p className="text-red-600 dark:text-red-400">
      Error: {error.message}
    </p>
  );
}
```

**Step 2: Create FeedbackBanner component**

Extract the repeated feedback display pattern:

```typescript
interface FeedbackBannerProps {
  feedback: { type: 'success' | 'error'; message: string } | null;
}

export function FeedbackBanner({ feedback }: FeedbackBannerProps) {
  if (!feedback) return null;
  const className = feedback.type === 'success'
    ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950/30'
    : 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/30';

  return (
    <p className={`text-sm px-3 py-2 rounded-lg ${className}`}>
      {feedback.message}
    </p>
  );
}
```

**Step 3: Replace duplicated patterns across components**

**Step 4: Run build to verify**

Run: `cd packages/web && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/web/src/components/
git commit -m "refactor(web): extract ErrorMessage and FeedbackBanner components"
```

---

### Task 20: Improve Web API Client Types

**Files:**
- Modify: `packages/web/src/api/client.ts`

**Step 1: Tighten types**

Review `client.ts` and ensure:
- All response types use proper interfaces (not `Record<string, unknown>`)
- The `request<T>` function has proper error typing
- All methods have specific return type annotations
- The `Bearer` prefix is a constant

**Step 2: Run build to verify**

Run: `cd packages/web && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/web/src/api/client.ts
git commit -m "refactor(web): improve API client type safety"
```

---

## Phase 4: Documentation & Final Verification

### Task 21: Documentation Accuracy Review

**Files:**
- Modify: `README.md`
- Modify: `docs/src/content/docs/configuration.md`
- Modify: `docs/src/content/docs/getting-started.md`
- Modify: `docs/src/content/docs/mcp-setup.md`
- Modify: `docs/src/content/docs/instructions-and-prompts.md`

**Step 1: Update README**

- If API key minimum length changed, update README quick start section
- If response shapes changed, update any API examples
- Verify the architecture diagram is still accurate
- Ensure web dashboard is not described as "read-only" (it has Settings with write capabilities)

**Step 2: Update configuration.md**

- Document the 32-character minimum API key requirement
- Verify all env vars still match `.env.example`
- Add any new env vars or constants

**Step 3: Update mcp-setup.md**

- If MCP health check was added, document it
- Verify all 8 tools and 6 prompts are still accurately described

**Step 4: Update getting-started.md**

- Update `.env.example` content if it changed
- Verify Docker compose instructions still work

**Step 5: Verify docs site builds**

Run: `cd docs && pnpm build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add README.md docs/
git commit -m "docs: update documentation to reflect v1 release readiness changes"
```

---

### Task 22: Update Landing Page if Needed

**Files:**
- Modify: `docs/src/pages/index.astro` (if any features/architecture changed)

**Step 1: Review landing page accuracy**

Check that:
- Feature descriptions still match implementation
- Architecture diagram is accurate
- Quick start commands work
- No outdated version numbers

**Step 2: Update if needed**

Only modify if something is inaccurate after the previous tasks.

**Step 3: Commit if changed**

```bash
git add docs/src/pages/index.astro
git commit -m "docs: update landing page to reflect v1 changes"
```

---

### Task 23: Full CI Verification

**Step 1: Run full CI pipeline locally**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

All 4 commands must pass.

**Step 2: Fix any issues found**

Address any lint errors, type errors, test failures, or build errors introduced by the refactoring.

**Step 3: Final commit if any fixes needed**

```bash
git add .
git commit -m "fix: resolve CI issues from v1 release readiness refactoring"
```

---

### Task 24: Update Test Files for Changed APIs

**Files:**
- Modify: Various test files in `packages/api/src/__tests__/`
- Modify: Various test files in `packages/mcp/src/__tests__/`

**Note:** This task runs throughout all phases. As each task modifies code, corresponding tests must be updated. Key test changes:

- API key tests: Update to use 32+ character keys
- Error response tests: Update expected shapes if `ERROR_CODE` constants change format
- Route tests: Update if response structures were normalized
- MCP tests: Update if tool handlers now return error responses instead of throwing

This is not a standalone task — it's tracked here as a reminder that every previous task must include test updates.

---

## Execution Notes

- **Order matters**: Tasks 1-4 (utilities extraction) must complete before Tasks 5-11 (which use those utilities)
- **Phase 2 depends on Phase 1**: MCP types should align with API response shapes
- **Phase 3 is independent**: Web changes don't affect API/MCP
- **Phase 4 must be last**: Docs should reflect the final state of all code changes
- **Run tests after every task**: Don't batch — catch regressions early
- **Commit after every task**: Small, reviewable commits with conventional commit messages
