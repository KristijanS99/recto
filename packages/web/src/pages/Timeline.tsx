import { BookOpen } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useEntries } from '../api/queries';
import { EmptyState } from '../components/EmptyState';
import { EntryCard } from '../components/EntryCard';
import { SkeletonList } from '../components/Skeleton';
import { TIMELINE_PAGE_LIMIT } from '../constants';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function Timeline() {
  const [searchParams] = useSearchParams();
  const tag = searchParams.get('tag') ?? undefined;
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useEntries({ tag, limit: TIMELINE_PAGE_LIMIT });

  const entries = data?.pages.flatMap((p) => p.data) ?? [];

  useDocumentTitle(tag ? `#${tag}` : 'Timeline');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-semibold text-sand-800 dark:text-sand-100">
          {tag ? `#${tag}` : 'Timeline'}
        </h2>
        {tag && (
          <a
            href="/"
            className="text-sm text-sand-500 hover:text-sand-700 dark:hover:text-sand-300 transition-colors"
          >
            clear filter
          </a>
        )}
      </div>

      {isLoading && <SkeletonList count={3} />}
      {isError && <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>}

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>

      {entries.length === 0 && !isLoading && (
        <EmptyState
          icon={BookOpen}
          title="No entries yet"
          description={
            tag ? `No entries tagged with #${tag}` : 'Start journaling to see your entries here'
          }
        />
      )}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-6 w-full py-2 text-sm text-sand-600 dark:text-sand-400 border border-sand-200 dark:border-sand-700 rounded-lg hover:bg-sand-100 dark:hover:bg-sand-800 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
