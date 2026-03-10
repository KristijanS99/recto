interface FeedbackBannerProps {
  feedback: { type: 'success' | 'error'; message: string } | null;
  className?: string;
}

export function FeedbackBanner({ feedback, className = '' }: FeedbackBannerProps) {
  if (!feedback) return null;

  const colorClass =
    feedback.type === 'success'
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <p className={`text-sm animate-fade-in ${colorClass} ${className}`.trim()}>
      {feedback.message}
    </p>
  );
}
