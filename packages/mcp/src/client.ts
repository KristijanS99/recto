import type {
  JournalEntry,
  PaginatedResponse,
  Prompt,
  ReflectResponse,
  SearchResponse,
} from './types.js';

export interface RectoClientConfig {
  apiUrl: string;
  apiKey: string;
}

export class RectoClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: RectoClientConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, '');
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new client instance using a different auth token.
   * Used to forward OAuth tokens from MCP clients to the API.
   */
  withToken(token: string): RectoClient {
    return new RectoClient({
      apiUrl: this.baseUrl,
      apiKey: token,
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    });

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new Error(`API returned invalid JSON (${res.status})`);
    }

    if (!res.ok) {
      const msg = (body as { error?: { message?: string } })?.error?.message ?? res.statusText;
      throw new Error(`API error (${res.status}): ${msg}`);
    }

    return body as T;
  }

  // --- Entries ---

  async createEntry(data: {
    content: string;
    title?: string;
    tags?: string[];
    mood?: string;
    people?: string[];
  }) {
    return this.request<JournalEntry>('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEntry(id: string) {
    return this.request<JournalEntry>(`/entries/${id}`);
  }

  async listEntries(params?: {
    limit?: number;
    cursor?: string;
    tag?: string;
    from?: string;
    to?: string;
    people?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.people) query.set('people', params.people);

    const qs = query.toString();
    return this.request<PaginatedResponse<JournalEntry>>(`/entries${qs ? `?${qs}` : ''}`);
  }

  async updateEntry(id: string, data: Record<string, unknown>) {
    return this.request<JournalEntry>(`/entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteEntry(id: string) {
    return this.request<{ message: string }>(`/entries/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Tags ---

  async addTags(entryId: string, tags: string[]) {
    return this.request<JournalEntry>(`/entries/${entryId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    });
  }

  // --- Media ---

  async addMedia(entryId: string, data: { type: string; url: string; caption?: string }) {
    return this.request<JournalEntry>(`/entries/${entryId}/media`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Search ---

  async search(params: {
    q: string;
    mode?: string;
    limit?: number;
    tag?: string;
    from?: string;
    to?: string;
  }) {
    const query = new URLSearchParams();
    query.set('q', params.q);
    if (params.mode) query.set('mode', params.mode);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.tag) query.set('tag', params.tag);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);

    return this.request<SearchResponse>(`/search?${query.toString()}`);
  }

  // --- Instructions ---

  async getInstructions(): Promise<{ id: string; content: string; updated_at: string }> {
    return this.request('/instructions');
  }

  // --- Prompts ---

  async getPrompts(): Promise<{ data: Prompt[] }> {
    return this.request('/prompts');
  }

  // --- Reflect ---

  async reflect(data: { query: string; from_date?: string; to_date?: string; limit?: number }) {
    return this.request<ReflectResponse>('/reflect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
