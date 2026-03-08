import { ChevronDown, ChevronRight, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Prompt } from '../api/client';
import { useDeletePrompt, useResetPrompt, useUpdatePrompt } from '../api/queries';
import { PromptForm } from './PromptForm';

export function PromptCard({ prompt }: { prompt: Prompt }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const updateMutation = useUpdatePrompt();
  const deleteMutation = useDeletePrompt();
  const resetMutation = useResetPrompt();

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function handleSave(data: { description: string; content: string }) {
    try {
      await updateMutation.mutateAsync({ id: prompt.id, data });
      setExpanded(false);
      showFeedback('success', 'Prompt updated.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save.');
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(prompt.id);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to delete.');
      setConfirmDelete(false);
    }
  }

  async function handleReset() {
    try {
      await resetMutation.mutateAsync(prompt.id);
      showFeedback('success', 'Prompt reset to default.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to reset.');
    }
  }

  return (
    <div className="notebook-page py-4 px-5">
      <div className="notebook-content">
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
            setConfirmDelete(false);
          }}
          className="w-full flex items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-medium text-sand-800 dark:text-sand-100">{prompt.name}</h3>
              {prompt.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sand-200 dark:bg-sand-700 text-sand-500 dark:text-sand-400 uppercase tracking-wider">
                  default
                </span>
              )}
            </div>
            <p className="text-sm text-sand-600 dark:text-sand-400">{prompt.description}</p>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-sand-400 shrink-0 mt-1" />
          ) : (
            <ChevronRight className="w-4 h-4 text-sand-400 shrink-0 mt-1" />
          )}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-sand-200 dark:border-sand-700">
            <PromptForm
              initialDescription={prompt.description}
              initialContent={prompt.content}
              isPending={updateMutation.isPending}
              onSave={handleSave}
              onCancel={() => setExpanded(false)}
            />

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-sand-100 dark:border-sand-700/50">
              {prompt.isDefault ? (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-sand-600 dark:text-sand-400 hover:text-sand-800 dark:hover:text-sand-200 border border-sand-200 dark:border-sand-700 hover:border-sand-300 dark:hover:border-sand-600 transition-all disabled:opacity-50"
                >
                  {resetMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  Reset to Default
                </button>
              ) : !confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-sand-600 dark:text-sand-400 hover:text-red-600 dark:hover:text-red-400 border border-sand-200 dark:border-sand-700 hover:border-red-300 dark:hover:border-red-500 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="text-sm text-sand-600 dark:text-sand-400">Delete this prompt?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Yes, delete'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-sm text-sand-600 dark:text-sand-400 hover:text-sand-800 dark:hover:text-sand-200 transition-colors"
                  >
                    Cancel
                  </button>
                </span>
              )}
            </div>
          </div>
        )}

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
    </div>
  );
}
