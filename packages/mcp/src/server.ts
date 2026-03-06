import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RectoClient } from './client.js';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatEntry(entry: Record<string, unknown>): string {
  const date = formatDate(entry.created_at as string);
  const title = entry.title ? `${entry.title}` : 'Untitled';
  const tags =
    Array.isArray(entry.tags) && entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
  const mood = entry.mood ? ` — mood: ${entry.mood}` : '';
  const snippet =
    typeof entry.content === 'string'
      ? entry.content.length > 200
        ? `${entry.content.slice(0, 200)}…`
        : entry.content
      : '';

  return `**${title}** (${date})${tags}${mood}\n${snippet}`;
}

export function createMcpServer(client: RectoClient): McpServer {
  const server = new McpServer({
    name: 'recto',
    version: '0.1.0',
  });

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
      const entry = await client.createEntry(args);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Journal entry created (ID: ${entry.id}).\n\n${formatEntry(entry)}\n\nAI enrichment will add title, tags, mood, and people in the background if configured.`,
          },
        ],
      };
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
      const entry = await client.getEntry(id);
      return {
        content: [
          {
            type: 'text' as const,
            text: formatEntry(entry),
          },
        ],
      };
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
      const result = await client.listEntries({
        limit: args.limit ?? 10,
        tag: args.tag,
        from: args.from,
        to: args.to,
        people: args.people,
      });

      if (result.data.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No entries found.' }] };
      }

      const formatted = result.data.map((e) => formatEntry(e)).join('\n\n---\n\n');
      const footer = result.has_more ? '\n\n_(More entries available)_' : '';

      return { content: [{ type: 'text' as const, text: `${formatted}${footer}` }] };
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
      const result = await client.search({
        q: args.query,
        mode: args.mode,
        limit: args.limit ?? 10,
      });

      if (result.results.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No matching entries found.' }] };
      }

      const formatted = result.results
        .map((r) => {
          const entry = formatEntry(r.entry);
          const highlights =
            r.highlights && r.highlights.length > 0 ? `\n> ${r.highlights[0]}` : '';
          return `${entry}${highlights}`;
        })
        .join('\n\n---\n\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `Found ${result.total} results (mode: ${result.mode_used}):\n\n${formatted}`,
          },
        ],
      };
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
      const result = await client.reflect({
        query: args.query,
        from_date: args.from,
        to_date: args.to,
      });

      const entriesInfo =
        result.entries_used.length > 0
          ? `\n\n_Based on ${result.entries_used.length} entries from ${formatDate(result.period.from)} to ${formatDate(result.period.to)}_`
          : '';

      return {
        content: [{ type: 'text' as const, text: `${result.reflection}${entriesInfo}` }],
      };
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
      const entry = await client.addTags(id, tags);
      const allTags = Array.isArray(entry.tags) ? entry.tags.join(', ') : 'none';
      return {
        content: [{ type: 'text' as const, text: `Tags updated. Entry now has tags: ${allTags}` }],
      };
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
      const query =
        args.style === 'detailed'
          ? 'Give a detailed summary of my journal entries from this period, including key events, emotions, and themes.'
          : 'Briefly summarize my journal entries from this period.';

      const result = await client.reflect({
        query,
        from_date: args.from,
        to_date: args.to,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `**Summary (${formatDate(args.from)} — ${formatDate(args.to)})**\n\n${result.reflection}`,
          },
        ],
      };
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
      await client.addMedia(args.entry_id, {
        type: args.type,
        url: args.url,
        caption: args.caption,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Media attached to entry ${args.entry_id}: ${args.type} — ${args.url}`,
          },
        ],
      };
    },
  );

  return server;
}
