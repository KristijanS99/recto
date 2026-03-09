import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TtlCache } from './cache.js';
import type { RectoClient } from './client.js';
import {
  DATE_LOCALE,
  DEFAULT_LIST_LIMIT,
  ENTRY_SNIPPET_LENGTH,
  MCP_SERVER_NAME,
  PROMPT_NAMES,
} from './constants.js';
import type { JournalEntry } from './types.js';

function findPackageVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === '@recto/mcp') return pkg.version ?? '0.0.0';
    }
    dir = dirname(dir);
  }
  return '0.0.0';
}

const pkgVersion = findPackageVersion();

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatEntry(entry: JournalEntry): string {
  const date = formatDate(entry.created_at);
  const title = entry.title ? `${entry.title}` : 'Untitled';
  const tags = entry.tags && entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
  const mood = entry.mood ? ` — mood: ${entry.mood}` : '';
  const snippet =
    entry.content.length > ENTRY_SNIPPET_LENGTH
      ? `${entry.content.slice(0, ENTRY_SNIPPET_LENGTH)}…`
      : entry.content;

  return `**${title}** (${date})${tags}${mood}\n${snippet}`;
}

function textResponse(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function createMcpServer(client: RectoClient, instructions: string): McpServer {
  const promptsCache = new TtlCache(() => client.getPrompts());

  const server = new McpServer({ name: MCP_SERVER_NAME, version: pkgVersion }, { instructions });

  // --- MCP Prompts ---
  for (const name of PROMPT_NAMES) {
    server.registerPrompt(name, { description: `Journaling prompt: ${name}` }, async () => {
      const { data } = await promptsCache.get();
      const prompt = data.find((p) => p.name === name);
      const text = prompt?.content ?? `Prompt "${name}" not found.`;
      return {
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text },
          },
        ],
      };
    });
  }

  // --- create_entry ---
  server.registerTool(
    'create_entry',
    {
      description:
        'Create a new journal entry. Use this when the user shares thoughts, experiences, reflections, or anything they want to record in their journal.',
      inputSchema: {
        content: z.string().describe('The journal entry content — what the user wants to record'),
        title: z.string().optional().describe('Optional title for the entry'),
        tags: z.array(z.string()).optional().describe('Optional tags to categorize the entry'),
        mood: z.string().optional().describe('Optional mood (e.g., happy, calm, anxious, excited)'),
        people: z.array(z.string()).optional().describe('Optional people mentioned in the entry'),
      },
    },
    async (args) => {
      try {
        const entry = await client.createEntry(args);
        return textResponse(
          `Journal entry created (ID: ${entry.id}).\n\n${formatEntry(entry)}\n\nAI enrichment will add title, tags, mood, and people in the background if configured.`,
        );
      } catch (error) {
        return textResponse(
          `Failed to create entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  );

  // --- get_entry ---
  server.registerTool(
    'get_entry',
    {
      description:
        'Get a specific journal entry by its ID. Use this to retrieve the full details of a known entry.',
      inputSchema: {
        id: z.string().describe('The UUID of the journal entry'),
      },
    },
    async ({ id }) => {
      try {
        const entry = await client.getEntry(id);
        return textResponse(formatEntry(entry));
      } catch (error) {
        return textResponse(
          `Failed to get entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  );

  // --- list_entries ---
  server.registerTool(
    'list_entries',
    {
      description:
        'List journal entries with optional filters. Use this to browse recent entries or find entries by tag, date range, or mentioned people.',
      inputSchema: {
        from: z.string().optional().describe('Start date (ISO 8601) to filter entries'),
        to: z.string().optional().describe('End date (ISO 8601) to filter entries'),
        tag: z.string().optional().describe('Filter by tag'),
        people: z.string().optional().describe('Filter by person mentioned'),
        limit: z.number().optional().describe('Max entries to return (default 10)'),
      },
    },
    async (args) => {
      try {
        const result = await client.listEntries({
          limit: args.limit ?? DEFAULT_LIST_LIMIT,
          tag: args.tag,
          from: args.from,
          to: args.to,
          people: args.people,
        });

        if (result.data.length === 0) {
          return textResponse('No entries found.');
        }

        const formatted = result.data.map((e) => formatEntry(e)).join('\n\n---\n\n');
        const footer = result.has_more ? '\n\n_(More entries available)_' : '';

        return textResponse(`${formatted}${footer}`);
      } catch (error) {
        return textResponse(
          `Failed to list entries: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  );

  // --- search_entries ---
  server.registerTool(
    'search_entries',
    {
      description:
        'Search journal entries by keyword or semantic meaning. Use this when the user wants to find entries about a specific topic, event, or feeling.',
      inputSchema: {
        query: z.string().describe('Search query — keywords, phrases, or natural language'),
        mode: z
          .enum(['hybrid', 'keyword', 'semantic'])
          .optional()
          .describe('Search mode: hybrid (default), keyword (full-text), or semantic (meaning)'),
        limit: z.number().optional().describe('Max results to return (default 10)'),
      },
    },
    async (args) => {
      try {
        const result = await client.search({
          q: args.query,
          mode: args.mode,
          limit: args.limit ?? DEFAULT_LIST_LIMIT,
        });

        if (result.results.length === 0) {
          return textResponse('No matching entries found.');
        }

        const formatted = result.results
          .map((r) => {
            const entry = formatEntry(r.entry);
            const highlights =
              r.highlights && r.highlights.length > 0 ? `\n> ${r.highlights[0]}` : '';
            return `${entry}${highlights}`;
          })
          .join('\n\n---\n\n');

        return textResponse(
          `Found ${result.total} results (mode: ${result.mode_used}):\n\n${formatted}`,
        );
      } catch (error) {
        return textResponse(
          `Failed to search entries: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  );

  // --- reflect ---
  server.registerTool(
    'reflect',
    {
      description:
        'Generate an AI-powered reflection on journal entries. Use this when the user asks for insights, patterns, or a summary of their journal over a period.',
      inputSchema: {
        query: z
          .string()
          .describe('What to reflect on — a question or topic (e.g., "How has my mood been?")'),
        from: z.string().optional().describe('Start date (ISO 8601) for the reflection period'),
        to: z.string().optional().describe('End date (ISO 8601) for the reflection period'),
      },
    },
    async (args) => {
      try {
        const result = await client.reflect({
          query: args.query,
          from_date: args.from,
          to_date: args.to,
        });

        const entriesInfo =
          result.entries_used.length > 0
            ? `\n\n_Based on ${result.entries_used.length} entries from ${formatDate(result.period.from)} to ${formatDate(result.period.to)}_`
            : '';

        return textResponse(`${result.reflection}${entriesInfo}`);
      } catch (error) {
        return textResponse(
          `Failed to reflect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  );

  // --- add_tags ---
  server.registerTool(
    'add_tags',
    {
      description:
        'Add tags to an existing journal entry. Use this when the user wants to categorize or label an entry.',
      inputSchema: {
        id: z.string().describe('The UUID of the journal entry'),
        tags: z.array(z.string()).describe('Tags to add'),
      },
    },
    async ({ id, tags }) => {
      try {
        const entry = await client.addTags(id, tags);
        const allTags = entry.tags ? entry.tags.join(', ') : 'none';
        return textResponse(`Tags updated. Entry now has tags: ${allTags}`);
      } catch (error) {
        return textResponse(
          `Failed to add tags: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  );

  // --- get_summary ---
  server.registerTool(
    'get_summary',
    {
      description:
        'Get a summary of journal entries for a specific time period. Use this when the user asks for a recap or overview of a day, week, or month.',
      inputSchema: {
        from: z.string().describe('Start date (ISO 8601)'),
        to: z.string().describe('End date (ISO 8601)'),
        style: z
          .enum(['brief', 'detailed'])
          .optional()
          .describe('Summary style: brief (default) or detailed'),
      },
    },
    async (args) => {
      try {
        const query =
          args.style === 'detailed'
            ? 'Give a detailed summary of my journal entries from this period, including key events, emotions, and themes.'
            : 'Briefly summarize my journal entries from this period.';

        const result = await client.reflect({
          query,
          from_date: args.from,
          to_date: args.to,
        });

        return textResponse(
          `**Summary (${formatDate(args.from)} — ${formatDate(args.to)})**\n\n${result.reflection}`,
        );
      } catch (error) {
        return textResponse(
          `Failed to get summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  );

  // --- add_media ---
  server.registerTool(
    'add_media',
    {
      description:
        'Attach a media reference (image, audio, video, or link) to a journal entry. Use this when the user shares a URL they want associated with an entry.',
      inputSchema: {
        entry_id: z.string().describe('The UUID of the journal entry'),
        url: z.string().describe('URL of the media'),
        type: z.enum(['image', 'audio', 'video', 'link']).describe('Type of media being attached'),
        caption: z.string().optional().describe('Optional caption for the media'),
      },
    },
    async (args) => {
      try {
        await client.addMedia(args.entry_id, {
          type: args.type,
          url: args.url,
          caption: args.caption,
        });
        return textResponse(`Media attached to entry ${args.entry_id}: ${args.type} — ${args.url}`);
      } catch (error) {
        return textResponse(
          `Failed to add media: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  );

  return server;
}
