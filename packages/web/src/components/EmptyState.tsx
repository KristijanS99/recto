import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <Icon className="w-12 h-12 text-sand-300 dark:text-sand-600 mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-medium text-sand-600 dark:text-sand-400 mb-1">{title}</h3>
      <p className="text-sm text-sand-500 dark:text-sand-500">{description}</p>
    </div>
  );
}
