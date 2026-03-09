import { describe, expect, it, vi } from 'vitest';
import type { RectoClient } from '../client.js';
import { createMcpServer } from '../server.js';

// Create a mock client with all methods
function createMockClient(): RectoClient {
  return {
    createEntry: vi.fn().mockResolvedValue({
      id: 'test-id-1',
      content: 'Test entry',
      title: null,
      tags: [],
      mood: null,
      people: [],
      created_at: '2024-01-15T10:00:00Z',
    }),
    getEntry: vi.fn().mockResolvedValue({
      id: 'test-id-1',
      content: 'Test entry content',
      title: 'My Entry',
      tags: ['work'],
      mood: 'happy',
      people: ['Alice'],
      created_at: '2024-01-15T10:00:00Z',
    }),
    listEntries: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'test-id-1',
          content: 'First entry',
          title: 'Entry 1',
          tags: ['work'],
          mood: 'calm',
          people: [],
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'test-id-2',
          content: 'Second entry',
          title: 'Entry 2',
          tags: ['personal'],
          mood: null,
          people: [],
          created_at: '2024-01-14T10:00:00Z',
        },
      ],
      next_cursor: null,
      has_more: false,
    }),
    updateEntry: vi.fn().mockResolvedValue({ id: 'test-id-1' }),
    deleteEntry: vi.fn().mockResolvedValue({ message: 'deleted' }),
    addTags: vi.fn().mockResolvedValue({
      id: 'test-id-1',
      tags: ['work', 'coding', 'new-tag'],
    }),
    addMedia: vi.fn().mockResolvedValue({
      id: 'test-id-1',
      media: [{ type: 'image', url: 'https://example.com/img.jpg' }],
    }),
    search: vi.fn().mockResolvedValue({
      results: [
        {
          entry: {
            id: 'test-id-1',
            content: 'Found this entry about coding',
            title: 'Coding Day',
            tags: ['coding'],
            mood: 'focused',
            people: [],
            created_at: '2024-01-15T10:00:00Z',
          },
          score: 0.95,
          highlights: ['Found this entry about <mark>coding</mark>'],
        },
      ],
      mode_used: 'hybrid',
      total: 1,
    }),
    reflect: vi.fn().mockResolvedValue({
      reflection: 'You have been feeling positive and productive lately.',
      entries_used: [{ id: 'test-id-1', title: 'Entry 1', created_at: '2024-01-15T10:00:00Z' }],
      period: { from: '2024-01-01T00:00:00Z', to: '2024-01-31T23:59:59Z' },
    }),
    getInstructions: vi.fn().mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      content: 'Test instructions content',
      updated_at: '2026-01-01T00:00:00.000Z',
    }),
    getPrompts: vi.fn().mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000010',
          name: 'daily-checkin',
          description: 'Daily Check-in',
          content: 'Walk me through your day.',
          is_default: true,
        },
        {
          id: '00000000-0000-0000-0000-000000000011',
          name: 'weekly-review',
          description: 'Weekly Review',
          content: 'Help me review my week.',
          is_default: true,
        },
        {
          id: '00000000-0000-0000-0000-000000000012',
          name: 'monthly-retrospective',
          description: 'Monthly Retrospective',
          content: 'Help me reflect on the past month.',
          is_default: true,
        },
        {
          id: '00000000-0000-0000-0000-000000000013',
          name: 'gratitude',
          description: 'Gratitude',
          content: 'What are you grateful for?',
          is_default: true,
        },
        {
          id: '00000000-0000-0000-0000-000000000014',
          name: 'idea-capture',
          description: 'Idea Capture',
          content: 'Tell me about your idea.',
          is_default: true,
        },
        {
          id: '00000000-0000-0000-0000-000000000015',
          name: 'goal-setting',
          description: 'Goal Setting',
          content: 'What goal do you want to set?',
          is_default: true,
        },
      ],
    }),
  } as unknown as RectoClient;
}

describe('MCP Server', () => {
  it('creates server with all tools registered', () => {
    const client = createMockClient();
    const server = createMcpServer(client, 'Test instructions content');
    expect(server).toBeDefined();
  });
});

describe('MCP Tools', () => {
  // Helper to call a tool on the MCP server
  async function callTool(toolName: string, args: Record<string, unknown>) {
    const client = createMockClient();
    const server = createMcpServer(client, 'Test instructions content');

    // Access internal tool registry via the server's underlying handler
    // We'll test through the protocol by creating a mock transport
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const mcpClient = new Client({ name: 'test-client', version: '1.0.0' });

    await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)]);

    const result = await mcpClient.callTool({ name: toolName, arguments: args });
    return { result, client };
  }

  it('create_entry calls API and returns confirmation', async () => {
    const { result, client } = await callTool('create_entry', {
      content: 'My journal entry',
      tags: ['test'],
    });

    expect(client.createEntry).toHaveBeenCalledWith({
      content: 'My journal entry',
      tags: ['test'],
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('test-id-1');
    expect(text).toContain('Journal entry created');
  });

  it('get_entry calls API and returns formatted entry', async () => {
    const { result, client } = await callTool('get_entry', { id: 'test-id-1' });

    expect(client.getEntry).toHaveBeenCalledWith('test-id-1');

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('My Entry');
    expect(text).toContain('work');
  });

  it('list_entries calls API with filters', async () => {
    const { result, client } = await callTool('list_entries', {
      tag: 'work',
      limit: 5,
    });

    expect(client.listEntries).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'work', limit: 5 }),
    );

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('Entry 1');
    expect(text).toContain('Entry 2');
  });

  it('list_entries shows empty message when no results', async () => {
    const client = createMockClient();
    (client.listEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [],
      next_cursor: null,
      has_more: false,
    });

    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.callTool({ name: 'list_entries', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('No entries found');
  });

  it('search_entries calls API and returns results', async () => {
    const { result, client } = await callTool('search_entries', {
      query: 'coding',
      mode: 'hybrid',
    });

    expect(client.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'coding', mode: 'hybrid' }),
    );

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('Coding Day');
    expect(text).toContain('hybrid');
  });

  it('reflect calls API and returns reflection', async () => {
    const { result, client } = await callTool('reflect', {
      query: 'How am I doing?',
      from: '2024-01-01T00:00:00Z',
    });

    expect(client.reflect).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'How am I doing?',
        from_date: '2024-01-01T00:00:00Z',
      }),
    );

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('positive and productive');
    expect(text).toContain('1 entries');
  });

  it('add_tags calls API and returns updated tags', async () => {
    const { result, client } = await callTool('add_tags', {
      id: 'test-id-1',
      tags: ['new-tag'],
    });

    expect(client.addTags).toHaveBeenCalledWith('test-id-1', ['new-tag']);

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('Tags updated');
    expect(text).toContain('new-tag');
  });

  it('get_summary calls reflect with auto-generated query', async () => {
    const { result, client } = await callTool('get_summary', {
      from: '2024-01-01T00:00:00Z',
      to: '2024-01-31T23:59:59Z',
    });

    expect(client.reflect).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('summarize'),
      }),
    );

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('Summary');
  });

  it('add_media calls API correctly', async () => {
    const { result, client } = await callTool('add_media', {
      entry_id: 'test-id-1',
      type: 'image',
      url: 'https://example.com/photo.jpg',
      caption: 'A photo',
    });

    expect(client.addMedia).toHaveBeenCalledWith('test-id-1', {
      type: 'image',
      url: 'https://example.com/photo.jpg',
      caption: 'A photo',
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('Media attached');
  });

  it('handles API errors gracefully', async () => {
    const client = createMockClient();
    (client.getEntry as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('API error (404): Entry not found'),
    );

    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.callTool({ name: 'get_entry', arguments: { id: 'bad-id' } });
    // MCP SDK returns isError: true for tool errors
    expect(result.isError).toBe(true);
  });
});

describe('MCP prompts', () => {
  it('should list available prompts', async () => {
    const client = createMockClient();
    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.listPrompts();
    expect(result.prompts.length).toBeGreaterThan(0);
    const names = result.prompts.map((p) => p.name);
    expect(names).toContain('daily-checkin');
    expect(names).toContain('weekly-review');
  });

  it('should return prompt content when invoked', async () => {
    const client = createMockClient();
    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.getPrompt({ name: 'daily-checkin' });
    const msg = result.messages[0];
    const text = typeof msg?.content === 'object' && 'text' in msg.content ? msg.content.text : '';
    expect(text).toContain('Walk me through your day');
  });
});

describe('Edge cases — search, list, format, prompts', () => {
  it('search_entries returns empty message when no results', async () => {
    const client = createMockClient();
    (client.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      results: [],
      mode_used: 'keyword',
      total: 0,
    });

    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.callTool({
      name: 'search_entries',
      arguments: { query: 'nonexistent' },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toBe('No matching entries found.');
  });

  it('list_entries shows "More entries available" when has_more is true', async () => {
    const client = createMockClient();
    (client.listEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        {
          id: 'test-id-1',
          content: 'First entry',
          title: 'Entry 1',
          tags: [],
          mood: null,
          people: [],
          created_at: '2024-01-15T10:00:00Z',
        },
      ],
      next_cursor: 'cursor-abc',
      has_more: true,
    });

    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.callTool({ name: 'list_entries', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('_(More entries available)_');
  });

  it('truncates content longer than 200 characters', async () => {
    const longContent = 'A'.repeat(300);
    const client = createMockClient();
    (client.getEntry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'test-id-long',
      content: longContent,
      title: 'Long Entry',
      tags: [],
      mood: null,
      people: [],
      created_at: '2024-01-15T10:00:00Z',
    });

    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.callTool({
      name: 'get_entry',
      arguments: { id: 'test-id-long' },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('…');
    expect(text).not.toContain(longContent);
  });

  it('shows "Untitled" when entry title is null', async () => {
    const client = createMockClient();
    (client.getEntry as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'test-id-notitle',
      content: 'Some content',
      title: null,
      tags: [],
      mood: null,
      people: [],
      created_at: '2024-01-15T10:00:00Z',
    });

    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.callTool({
      name: 'get_entry',
      arguments: { id: 'test-id-notitle' },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('Untitled');
  });

  it('returns "not found" when prompt data is empty', async () => {
    const client = createMockClient();
    (client.getPrompts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [],
    });

    const server = createMcpServer(client, 'Test instructions content');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([mcpClient.connect(ct), server.connect(st)]);

    const result = await mcpClient.getPrompt({ name: 'daily-checkin' });
    const msg = result.messages[0];
    const text = typeof msg?.content === 'object' && 'text' in msg.content ? msg.content.text : '';
    expect(text).toContain('not found');
  });
});

describe('individual prompt handlers', () => {
  const promptNames = [
    'daily-checkin',
    'weekly-review',
    'monthly-retrospective',
    'gratitude',
    'idea-capture',
    'goal-setting',
  ] as const;

  const expectedContent: Record<string, string> = {
    'daily-checkin': 'Walk me through your day.',
    'weekly-review': 'Help me review my week.',
    'monthly-retrospective': 'Help me reflect on the past month.',
    gratitude: 'What are you grateful for?',
    'idea-capture': 'Tell me about your idea.',
    'goal-setting': 'What goal do you want to set?',
  };

  for (const name of promptNames) {
    it(`returns content for "${name}" prompt`, async () => {
      const client = createMockClient();
      const server = createMcpServer(client, 'Test instructions content');
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

      const [ct, st] = InMemoryTransport.createLinkedPair();
      const mcpClient = new Client({ name: 'test', version: '1.0.0' });
      await Promise.all([mcpClient.connect(ct), server.connect(st)]);

      const result = await mcpClient.getPrompt({ name });
      const msg = result.messages[0];
      expect(msg?.role).toBe('user');
      const text =
        typeof msg?.content === 'object' && 'text' in msg.content ? msg.content.text : '';
      expect(text).toBe(expectedContent[name]);
    });
  }
});
