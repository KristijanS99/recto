import { z } from 'zod';
import { DEFAULT_PAGE_LIMIT } from './constants.js';

// --- UUID param validation ---
export const uuidParam = z.string().uuid('Invalid UUID format');

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
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_LIMIT),
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

// --- Instructions ---
export const updateInstructionsSchema = z.object({
  content: z.string().min(1),
});

// --- Prompts ---
export const createPromptSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Name must be a lowercase slug (letters, numbers, hyphens)'),
  description: z.string().min(1),
  content: z.string().min(1),
});

export const updatePromptSchema = z.object({
  description: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

// --- Raw SQL row types for search queries ---
export interface KeywordSearchRow {
  id: string;
  score: number;
  headline: string;
}

export interface SemanticSearchRow {
  id: string;
  score: number;
}

// --- Error response shape ---
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
