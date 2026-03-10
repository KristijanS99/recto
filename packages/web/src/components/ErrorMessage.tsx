interface ErrorMessageProps {
  error: Error;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>;
}
