import { Link } from 'react-router';
import { useEntries } from '../api/queries';

export function Tags() {
  const { data, isLoading, isError, error } = useEntries({ limit: 100 });

  const entries = data?.pages.flatMap((p) => p.data) ?? [];
  const tagCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-sand-800 dark:text-sand-100 mb-6">Tags</h2>

      {isLoading && <p className="text-sand-500">Loading...</p>}
      {isError && <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>}

      {sorted.length === 0 && !isLoading && (
        <p className="text-sand-500 text-center py-12">No tags found.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {sorted.map(([tag, count]) => (
          <Link
            key={tag}
            to={`/?tag=${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-700 dark:text-sand-300 hover:border-sand-300 dark:hover:border-sand-600 transition-colors"
          >
            <span className="text-sm">#{tag}</span>
            <span className="text-xs text-sand-400">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
