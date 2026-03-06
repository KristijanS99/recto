import { useState } from 'react';
import { Link } from 'react-router';
import { useSearch } from '../api/queries';
import { TagBadge } from '../components/TagBadge';

const MODES = ['hybrid', 'keyword', 'semantic'] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function Search() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<(typeof MODES)[number]>('hybrid');

  const { data, isLoading, isError, error } = useSearch(query, mode);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(input.trim());
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-sand-800 dark:text-sand-100 mb-6">Search</h2>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search your journal..."
            className="flex-1 px-4 py-2 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-900 dark:text-sand-100 placeholder:text-sand-400 focus:outline-none focus:ring-2 focus:ring-sand-300 dark:focus:ring-sand-600"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-sand-700 dark:bg-sand-200 text-white dark:text-sand-900 text-sm font-medium hover:bg-sand-800 dark:hover:bg-sand-100 transition-colors"
          >
            Search
          </button>
        </div>

        <div className="flex gap-1 mt-3">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                if (query) setQuery(input.trim());
              }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                mode === m
                  ? 'bg-sand-700 dark:bg-sand-200 text-white dark:text-sand-900'
                  : 'bg-sand-100 dark:bg-sand-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-sand-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </form>

      {isLoading && <p className="text-sand-500">Searching...</p>}
      {isError && <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>}

      {data && (
        <p className="text-sm text-sand-500 mb-4">
          {data.total} result{data.total !== 1 ? 's' : ''} (mode: {data.mode_used})
        </p>
      )}

      <div className="flex flex-col gap-3">
        {data?.results.map((r) => (
          <Link
            key={r.entry.id}
            to={`/entry/${r.entry.id}`}
            className="block p-5 rounded-xl border border-sand-200 dark:border-sand-700 hover:border-sand-300 dark:hover:border-sand-600 bg-white dark:bg-sand-800 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-medium text-sand-800 dark:text-sand-100">
                {r.entry.title ?? 'Untitled'}
              </h3>
              <time className="text-xs text-sand-500 shrink-0">
                {formatDate(r.entry.created_at)}
              </time>
            </div>
            {r.highlights?.[0] && (
              <p
                className="text-sm text-sand-600 dark:text-sand-400 mb-2 [&_mark]:bg-sand-300 dark:[&_mark]:bg-sand-600 [&_mark]:rounded [&_mark]:px-0.5"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: server-generated ts_headline HTML
                dangerouslySetInnerHTML={{ __html: r.highlights[0] }}
              />
            )}
            <div className="flex items-center gap-2">
              {r.entry.tags?.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          </Link>
        ))}
      </div>

      {query && data && data.results.length === 0 && (
        <p className="text-sand-500 text-center py-12">No results found.</p>
      )}
    </div>
  );
}
