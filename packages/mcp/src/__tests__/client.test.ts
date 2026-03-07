import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RectoClient } from '../client.js';

function mockResponse(body: unknown, status = 200, statusText = 'OK') {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('RectoClient', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  function createClient(apiUrl = 'http://localhost:3000', apiKey = 'test-key') {
    return new RectoClient({ apiUrl, apiKey });
  }

  // --- Constructor ---

  describe('constructor', () => {
    it('strips trailing slash from apiUrl', async () => {
      const client = createClient('http://localhost:3000/');
      mockFetch.mockResolvedValue(mockResponse({ data: [] }));
      await client.listEntries();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('http://localhost:3000/entries');
    });

    it('sets Authorization and Content-Type headers', async () => {
      const client = createClient('http://localhost:3000', 'my-secret');
      mockFetch.mockResolvedValue(mockResponse({}));
      await client.getEntry('1');
      const init = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer my-secret');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  // --- request() error handling ---

  describe('request error handling', () => {
    it('throws with API error message on non-2xx response', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(
        mockResponse({ error: { message: 'Not found' } }, 404, 'Not Found'),
      );
      await expect(client.getEntry('missing')).rejects.toThrow('API error (404): Not found');
    });

    it('falls back to statusText when error message is absent', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(mockResponse({}, 500, 'Internal Server Error'));
      await expect(client.getEntry('x')).rejects.toThrow('API error (500): Internal Server Error');
    });
  });

  // --- createEntry ---

  describe('createEntry', () => {
    it('sends POST /entries with body', async () => {
      const client = createClient();
      const entry = { content: 'Hello', title: 'Hi', tags: ['a'], mood: 'happy', people: ['Bob'] };
      mockFetch.mockResolvedValue(mockResponse({ id: '1', ...entry }));

      const result = await client.createEntry(entry);

      expect(result).toEqual({ id: '1', ...entry });
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/entries');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(entry);
    });
  });

  // --- getEntry ---

  describe('getEntry', () => {
    it('sends GET /entries/:id', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(mockResponse({ id: 'abc', content: 'test' }));

      const result = await client.getEntry('abc');

      expect(result).toEqual({ id: 'abc', content: 'test' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('http://localhost:3000/entries/abc');
    });
  });

  // --- listEntries ---

  describe('listEntries', () => {
    it('sends GET /entries without query string when no params', async () => {
      const client = createClient();
      const body = { data: [], next_cursor: null, has_more: false };
      mockFetch.mockResolvedValue(mockResponse(body));

      await client.listEntries();

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('http://localhost:3000/entries');
    });

    it('builds query string from all params', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(mockResponse({ data: [], next_cursor: null, has_more: false }));

      await client.listEntries({
        limit: 10,
        cursor: 'cur1',
        tag: 'work',
        from: '2024-01-01',
        to: '2024-12-31',
        people: 'Alice',
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get('limit')).toBe('10');
      expect(url.searchParams.get('cursor')).toBe('cur1');
      expect(url.searchParams.get('tag')).toBe('work');
      expect(url.searchParams.get('from')).toBe('2024-01-01');
      expect(url.searchParams.get('to')).toBe('2024-12-31');
      expect(url.searchParams.get('people')).toBe('Alice');
    });
  });

  // --- updateEntry ---

  describe('updateEntry', () => {
    it('sends PATCH /entries/:id with body', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(mockResponse({ id: '1', content: 'updated' }));

      await client.updateEntry('1', { content: 'updated' });

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/entries/1');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ content: 'updated' });
    });
  });

  // --- deleteEntry ---

  describe('deleteEntry', () => {
    it('sends DELETE /entries/:id', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(mockResponse({ message: 'deleted' }));

      const result = await client.deleteEntry('1');

      expect(result).toEqual({ message: 'deleted' });
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/entries/1');
      expect(init.method).toBe('DELETE');
    });
  });

  // --- addTags ---

  describe('addTags', () => {
    it('sends POST /entries/:id/tags with tags array', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(mockResponse({ tags: ['a', 'b'] }));

      await client.addTags('e1', ['a', 'b']);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/entries/e1/tags');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ tags: ['a', 'b'] });
    });
  });

  // --- addMedia ---

  describe('addMedia', () => {
    it('sends POST /entries/:id/media with media data', async () => {
      const client = createClient();
      const media = { type: 'image', url: 'https://img.test/1.png', caption: 'photo' };
      mockFetch.mockResolvedValue(mockResponse({ id: 'm1', ...media }));

      await client.addMedia('e1', media);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/entries/e1/media');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(media);
    });
  });

  // --- search ---

  describe('search', () => {
    it('builds query string with all search params', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(mockResponse({ results: [], mode_used: 'hybrid', total: 0 }));

      await client.search({
        q: 'hello world',
        mode: 'semantic',
        limit: 5,
        tag: 'work',
        from: '2024-01-01',
        to: '2024-06-30',
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe('/search');
      expect(url.searchParams.get('q')).toBe('hello world');
      expect(url.searchParams.get('mode')).toBe('semantic');
      expect(url.searchParams.get('limit')).toBe('5');
      expect(url.searchParams.get('tag')).toBe('work');
      expect(url.searchParams.get('from')).toBe('2024-01-01');
      expect(url.searchParams.get('to')).toBe('2024-06-30');
    });

    it('only includes q when no optional params given', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(mockResponse({ results: [], mode_used: 'hybrid', total: 0 }));

      await client.search({ q: 'test' });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get('q')).toBe('test');
      expect(url.searchParams.has('mode')).toBe(false);
      expect(url.searchParams.has('limit')).toBe(false);
    });
  });

  // --- getInstructions ---

  describe('getInstructions', () => {
    it('sends GET /instructions', async () => {
      const client = createClient();
      const data = { id: 'i1', content: 'Be concise', updated_at: '2024-01-01T00:00:00Z' };
      mockFetch.mockResolvedValue(mockResponse(data));

      const result = await client.getInstructions();

      expect(result).toEqual(data);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('http://localhost:3000/instructions');
    });
  });

  // --- getPrompts ---

  describe('getPrompts', () => {
    it('sends GET /prompts', async () => {
      const client = createClient();
      const data = {
        data: [
          {
            id: 'p1',
            name: 'daily',
            description: 'Daily check-in',
            content: 'How was your day?',
            is_default: true,
          },
        ],
      };
      mockFetch.mockResolvedValue(mockResponse(data));

      const result = await client.getPrompts();

      expect(result).toEqual(data);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('http://localhost:3000/prompts');
    });
  });

  // --- reflect ---

  describe('reflect', () => {
    it('sends POST /reflect with body', async () => {
      const client = createClient();
      const reqData = {
        query: 'summarize week',
        from_date: '2024-01-01',
        to_date: '2024-01-07',
        limit: 5,
      };
      const resData = {
        reflection: 'Good week',
        entries_used: [{ id: 'e1', title: 'Monday', created_at: '2024-01-01T00:00:00Z' }],
        period: { from: '2024-01-01', to: '2024-01-07' },
      };
      mockFetch.mockResolvedValue(mockResponse(resData));

      const result = await client.reflect(reqData);

      expect(result).toEqual(resData);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/reflect');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(reqData);
    });
  });
});
