import { Link } from 'react-router';
import type { Entry } from '../api/client';
import { TagBadge } from './TagBadge';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function EntryCard({ entry }: { entry: Entry }) {
  const title =
    entry.title ?? entry.content.slice(0, 80) + (entry.content.length > 80 ? '...' : '');
  const snippet = entry.content.length > 200 ? `${entry.content.slice(0, 200)}...` : entry.content;

  return (
    <Link
      to={`/entry/${entry.id}`}
      className="notebook-page block py-4 px-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg"
    >
      {/* Header area — above the margin */}
      <div className="notebook-content">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-medium text-sand-800 dark:text-sand-100 line-clamp-1">{title}</h3>
          {entry.mood && (
            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-sand-100/80 dark:bg-sand-700/80 text-sand-600 dark:text-sand-300">
              {entry.mood}
            </span>
          )}
        </div>
        <p className="text-sm text-sand-600 dark:text-sand-400 mb-2 line-clamp-2 notebook-lines">
          {snippet}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <time className="text-xs text-sand-500 dark:text-sand-500">
            {formatDate(entry.created_at)}
          </time>
          {entry.tags?.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      </div>
    </Link>
  );
}
