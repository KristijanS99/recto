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

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    });

    const body = await res.json();

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
    return this.request<Record<string, unknown>>('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEntry(id: string) {
    return this.request<Record<string, unknown>>(`/entries/${id}`);
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
    return this.request<{
      data: Record<string, unknown>[];
      next_cursor: string | null;
      has_more: boolean;
    }>(`/entries${qs ? `?${qs}` : ''}`);
  }

  async updateEntry(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/entries/${id}`, {
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
    return this.request<Record<string, unknown>>(`/entries/${entryId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    });
  }

  // --- Media ---

  async addMedia(entryId: string, data: { type: string; url: string; caption?: string }) {
    return this.request<Record<string, unknown>>(`/entries/${entryId}/media`, {
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

    return this.request<{
      results: Array<{
        entry: Record<string, unknown>;
        score: number;
        highlights?: string[];
      }>;
      mode_used: string;
      total: number;
    }>(`/search?${query.toString()}`);
  }

  // --- Instructions ---

  async getInstructions(): Promise<{ id: string; content: string; updated_at: string }> {
    return this.request('/instructions');
  }

  // --- Prompts ---

  async getPrompts(): Promise<{
    data: Array<{
      id: string;
      name: string;
      description: string;
      content: string;
      is_default: boolean;
    }>;
  }> {
    return this.request('/prompts');
  }

  // --- Reflect ---

  async reflect(data: { query: string; from_date?: string; to_date?: string; limit?: number }) {
    return this.request<{
      reflection: string;
      entries_used: Array<{ id: string; title: string | null; created_at: string }>;
      period: { from: string; to: string };
    }>('/reflect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
