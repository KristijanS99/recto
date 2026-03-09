import { useEffect, useState } from 'react';
import { FEEDBACK_DISMISS_MS } from '../constants';

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

export function useFeedback(dismissMs = FEEDBACK_DISMISS_MS) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), dismissMs);
      return () => clearTimeout(timer);
    }
  }, [feedback, dismissMs]);

  return { feedback, setFeedback };
}
