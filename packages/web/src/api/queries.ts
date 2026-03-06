import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ListEntriesParams } from './client';
import { api } from './client';

const STALE_TIME = 30_000;

export function useEntries(params?: Omit<ListEntriesParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: ['entries', params],
    queryFn: ({ pageParam }) => api.listEntries({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
    staleTime: STALE_TIME,
  });
}

export function useEntry(id: string) {
  return useQuery({
    queryKey: ['entry', id],
    queryFn: () => api.getEntry(id),
    staleTime: STALE_TIME,
  });
}

export function useSearch(query: string, mode?: 'hybrid' | 'keyword' | 'semantic') {
  return useQuery({
    queryKey: ['search', query, mode],
    queryFn: () => api.search({ q: query, mode }),
    enabled: query.length > 0,
    staleTime: STALE_TIME,
  });
}
