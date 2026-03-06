import { Link } from 'react-router';

export function TagBadge({ tag }: { tag: string }) {
  return (
    <Link
      to={`/?tag=${encodeURIComponent(tag)}`}
      className="inline-block px-2 py-0.5 text-xs rounded-full bg-sand-200 dark:bg-sand-700 text-sand-700 dark:text-sand-300 hover:bg-sand-300 dark:hover:bg-sand-600 transition-colors"
    >
      {tag}
    </Link>
  );
}
