import { Tag } from 'lucide-react';
import { Link } from 'react-router';
import { useEntries } from '../api/queries';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { SkeletonList } from '../components/Skeleton';
import { TAGS_ENTRY_LIMIT } from '../constants';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function Tags() {
  const { data, isLoading, isError, error } = useEntries({ limit: TAGS_ENTRY_LIMIT });

  const entries = data?.pages.flatMap((p) => p.data) ?? [];
  const tagCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  useDocumentTitle('Tags');

  return (
    <div>
      <h2 className="text-2xl font-semibold text-sand-800 dark:text-sand-100 mb-6">Tags</h2>

      {isLoading && <SkeletonList count={2} />}
      {isError && <ErrorMessage error={error} />}

      {sorted.length === 0 && !isLoading && (
        <EmptyState
          icon={Tag}
          title="No tags yet"
          description="Tags will appear here once you start tagging your entries"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {sorted.map(([tag, count]) => (
          <Link
            key={tag}
            to={`/?tag=${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-700 dark:text-sand-300 hover:border-sand-300 dark:hover:border-sand-600 transition-all duration-200 hover:scale-[1.02] hover:shadow-sm"
          >
            <span className="text-sm">#{tag}</span>
            <span className="text-xs text-sand-400 dark:text-sand-500">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
