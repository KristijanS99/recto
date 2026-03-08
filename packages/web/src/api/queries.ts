import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useInstructions() {
  return useQuery({
    queryKey: ['instructions'],
    queryFn: () => api.getInstructions(),
    staleTime: STALE_TIME,
  });
}

export function useUpdateInstructions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.updateInstructions(content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructions'] }),
  });
}

export function useResetInstructions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetInstructions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructions'] }),
  });
}

export function usePrompts() {
  return useQuery({
    queryKey: ['prompts'],
    queryFn: () => api.getPrompts(),
    staleTime: STALE_TIME,
  });
}

export function useCreatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description: string; content: string }) =>
      api.createPrompt(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prompts'] }),
  });
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { description?: string; content?: string } }) =>
      api.updatePrompt(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prompts'] }),
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePrompt(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prompts'] }),
  });
}

export function useResetPrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resetPrompt(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prompts'] }),
  });
}
