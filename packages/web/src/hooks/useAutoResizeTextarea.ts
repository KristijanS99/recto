import { type RefObject, useEffect } from 'react';

export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  dependency: string,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: dependency param triggers textarea height recalculation
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [ref, dependency]);
}
