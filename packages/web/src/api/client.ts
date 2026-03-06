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
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

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
