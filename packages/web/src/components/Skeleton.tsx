export function SkeletonCard() {
  return (
    <div className="notebook-page py-4 px-5">
      <div className="notebook-content">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="h-5 w-48 rounded bg-sand-200 dark:bg-sand-700 animate-pulse-soft" />
          <div className="h-5 w-16 rounded-full bg-sand-200 dark:bg-sand-700 animate-pulse-soft" />
        </div>
        <div className="space-y-2 mb-3">
          <div className="h-4 w-full rounded bg-sand-100 dark:bg-sand-700/50 animate-pulse-soft" />
          <div className="h-4 w-3/4 rounded bg-sand-100 dark:bg-sand-700/50 animate-pulse-soft" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-20 rounded bg-sand-100 dark:bg-sand-700/50 animate-pulse-soft" />
          <div className="h-5 w-12 rounded-full bg-sand-200 dark:bg-sand-700 animate-pulse-soft" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders have no stable id
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="notebook-page py-6 px-5">
      <div className="notebook-content animate-pulse-soft">
        <div className="h-7 w-64 rounded bg-sand-200 dark:bg-sand-700 mb-2" />
        <div className="h-4 w-48 rounded bg-sand-100 dark:bg-sand-700/50 mb-4" />
        <div className="flex gap-2 mb-4">
          <div className="h-5 w-16 rounded-full bg-sand-200 dark:bg-sand-700" />
          <div className="h-5 w-20 rounded-full bg-sand-200 dark:bg-sand-700" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-sand-100 dark:bg-sand-700/50" />
          <div className="h-4 w-full rounded bg-sand-100 dark:bg-sand-700/50" />
          <div className="h-4 w-5/6 rounded bg-sand-100 dark:bg-sand-700/50" />
          <div className="h-4 w-full rounded bg-sand-100 dark:bg-sand-700/50" />
          <div className="h-4 w-2/3 rounded bg-sand-100 dark:bg-sand-700/50" />
        </div>
      </div>
    </div>
  );
}
