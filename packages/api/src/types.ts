import { z } from 'zod';

// --- Media ---
export const mediaItemSchema = z.object({
  type: z.enum(['image', 'audio', 'video', 'link']),
  url: z.url(),
  caption: z.string().optional(),
});

// --- Entry creation ---
export const createEntrySchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mood: z.string().optional(),
  people: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// --- Entry update ---
export const updateEntrySchema = z.object({
  content: z.string().min(1).optional(),
  title: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  mood: z.string().nullable().optional(),
  people: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// --- Pagination ---
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// --- Entry list filters ---
export const entryFiltersSchema = paginationSchema.extend({
  tag: z.string().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  people: z.string().optional(),
});

// --- Tags ---
export const addTagsSchema = z.object({
  tags: z.array(z.string().min(1)).min(1),
});

export const removeTagsSchema = addTagsSchema;

// --- Media add ---
export const addMediaSchema = mediaItemSchema;

// --- Cursor encoding ---
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString();
    const [isoDate, id] = decoded.split('|');
    if (!isoDate || !id) return null;
    const createdAt = new Date(isoDate);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

// --- Error response shape ---
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
