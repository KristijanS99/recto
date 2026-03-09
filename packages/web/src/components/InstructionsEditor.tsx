import { Loader2, RotateCcw, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useInstructions, useResetInstructions, useUpdateInstructions } from '../api/queries';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import { useFeedback } from '../hooks/useFeedback';
import { SkeletonDetail } from './Skeleton';

export function InstructionsEditor() {
  const { data, isLoading, isError, error } = useInstructions();
  const updateMutation = useUpdateInstructions();
  const resetMutation = useResetInstructions();

  const [content, setContent] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const { feedback, setFeedback } = useFeedback();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (data) setContent(data.content);
  }, [data]);

  useAutoResizeTextarea(textareaRef, content);

  const isDirty = data ? content !== data.content : false;
  const isSaving = updateMutation.isPending || resetMutation.isPending;

  async function handleSave() {
    try {
      await updateMutation.mutateAsync(content);
      setFeedback({ type: 'success', message: 'Instructions saved.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save.',
      });
    }
  }

  async function handleReset() {
    try {
      await resetMutation.mutateAsync();
      setConfirmReset(false);
      setFeedback({ type: 'success', message: 'Instructions reset to default.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reset.',
      });
    }
  }

  if (isLoading) return <SkeletonDetail />;
  if (isError) return <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>;

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-sand-500 dark:text-sand-400 mb-4">
        These instructions are automatically sent to your AI assistant when it connects via MCP.
        Changes may take a few minutes to reach connected clients. Reconnect your AI client to apply
        immediately.
      </p>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full min-h-[200px] px-4 py-3 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-900 dark:text-sand-100 text-sm font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-sand-400 dark:focus:ring-sand-500 transition-shadow"
        disabled={isSaving}
      />

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sand-700 dark:bg-sand-200 text-white dark:text-sand-900 text-sm font-medium hover:bg-sand-800 dark:hover:bg-sand-100 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </button>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-sand-300 dark:border-sand-600 text-sand-600 dark:text-sand-400 text-sm hover:border-red-300 hover:text-red-600 dark:hover:border-red-500 dark:hover:text-red-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="text-sm text-sand-600 dark:text-sand-400">Are you sure?</span>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {resetMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Yes, reset'
              )}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-3 py-1.5 rounded-lg text-sm text-sand-600 dark:text-sand-400 hover:text-sand-800 dark:hover:text-sand-200 transition-colors"
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {feedback && (
        <p
          className={`text-sm mt-3 animate-fade-in ${
            feedback.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
