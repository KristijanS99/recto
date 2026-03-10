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
