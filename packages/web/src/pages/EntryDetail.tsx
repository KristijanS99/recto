import { useNavigate, useParams } from 'react-router';
import { useEntry } from '../api/queries';
import { TagBadge } from '../components/TagBadge';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function EntryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading, isError, error } = useEntry(id ?? '');

  if (!id) return <p className="text-sand-500">Entry not found.</p>;
  if (isLoading) return <p className="text-sand-500">Loading...</p>;
  if (isError) return <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>;
  if (!entry) return <p className="text-sand-500">Entry not found.</p>;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm text-sand-500 hover:text-sand-700 dark:hover:text-sand-300 mb-6 inline-block"
      >
        &larr; Back
      </button>

      <article>
        <h1 className="text-2xl font-semibold text-sand-800 dark:text-sand-100 mb-2">
          {entry.title ?? 'Untitled'}
        </h1>

        <time className="text-sm text-sand-500 block mb-4">{formatDate(entry.created_at)}</time>

        {/* Metadata */}
        <div className="flex items-center gap-3 flex-wrap mb-6">
          {entry.mood && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-sand-200 dark:bg-sand-700 text-sand-600 dark:text-sand-300">
              {entry.mood}
            </span>
          )}
          {entry.tags?.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          {entry.people?.map((person) => (
            <span
              key={person}
              className="text-xs px-2 py-0.5 rounded-full bg-sand-100 dark:bg-sand-700 text-sand-600 dark:text-sand-300"
            >
              @{person}
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="prose prose-sand dark:prose-invert max-w-none">
          {entry.content.split('\n').map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: content lines have no stable id
            <p key={i}>{line || '\u00A0'}</p>
          ))}
        </div>

        {/* Media */}
        {entry.media && entry.media.length > 0 && (
          <div className="mt-8 border-t border-sand-200 dark:border-sand-700 pt-6">
            <h2 className="text-sm font-medium text-sand-600 dark:text-sand-400 mb-3">Media</h2>
            <div className="flex flex-col gap-3">
              {entry.media.map((item) => (
                <div key={item.url} className="flex items-center gap-3">
                  <span className="text-xs uppercase text-sand-500">{item.type}</span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sand-700 dark:text-sand-300 underline truncate"
                  >
                    {item.caption ?? item.url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
