import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '../types.js';

describe('encodeCursor', () => {
  it('produces a base64url string', () => {
    const cursor = encodeCursor(new Date('2025-01-15T10:30:00.000Z'), 'abc-123');
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('round-trips through decodeCursor', () => {
    const date = new Date('2025-06-01T12:00:00.000Z');
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const cursor = encodeCursor(date, id);
    const result = decodeCursor(cursor);
    expect(result).not.toBeNull();
    expect(result!.createdAt.toISOString()).toBe(date.toISOString());
    expect(result!.id).toBe(id);
  });
});

describe('decodeCursor', () => {
  it('returns null for garbage input', () => {
    expect(decodeCursor('not-a-valid-cursor!!!')).toBeNull();
  });

  it('returns null when decoded has no pipe separator', () => {
    const noPipe = Buffer.from('nopipehere').toString('base64url');
    expect(decodeCursor(noPipe)).toBeNull();
  });

  it('returns null when date part is invalid', () => {
    const badDate = Buffer.from('not-a-date|some-id').toString('base64url');
    expect(decodeCursor(badDate)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('handles valid cursor with ISO date and UUID', () => {
    const iso = '2024-12-25T00:00:00.000Z';
    const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const cursor = Buffer.from(`${iso}|${uuid}`).toString('base64url');
    const result = decodeCursor(cursor);
    expect(result).not.toBeNull();
    expect(result!.createdAt).toEqual(new Date(iso));
    expect(result!.id).toBe(uuid);
  });
});
