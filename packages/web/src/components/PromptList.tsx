import { MessageSquarePlus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCreatePrompt, usePrompts } from '../api/queries';
import { FEEDBACK_DISMISS_MS } from '../constants';
import { EmptyState } from './EmptyState';
import { PromptCard } from './PromptCard';
import { PromptForm } from './PromptForm';
import { SkeletonList } from './Skeleton';

export function PromptList() {
  const { data, isLoading, isError, error } = usePrompts();
  const createMutation = useCreatePrompt();
  const [showCreate, setShowCreate] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), FEEDBACK_DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  async function handleCreate(formData: { name?: string; description: string; content: string }) {
    if (!formData.name) return;
    try {
      await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        content: formData.content,
      });
      setShowCreate(false);
      setFeedback({ type: 'success', message: 'Prompt created.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create prompt.',
      });
    }
  }

  if (isLoading) return <SkeletonList count={3} />;
  if (isError) return <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>;

  const prompts = data?.data ?? [];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-sand-500 dark:text-sand-400">
          Prompt templates available to the AI via MCP.
        </p>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sand-700 dark:bg-sand-200 text-white dark:text-sand-900 text-sm font-medium hover:bg-sand-800 dark:hover:bg-sand-100 transition-all duration-200 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Prompt
          </button>
        )}
      </div>

      {feedback && (
        <p
          className={`text-sm mb-3 animate-fade-in ${
            feedback.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {feedback.message}
        </p>
      )}

      {showCreate && (
        <div className="notebook-page py-4 px-5 mb-3">
          <div className="notebook-content">
            <h3 className="font-medium text-sand-800 dark:text-sand-100 mb-3">New Prompt</h3>
            <PromptForm
              isNew
              isPending={createMutation.isPending}
              onSave={handleCreate}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}

      {prompts.length === 0 && !showCreate && (
        <EmptyState
          icon={MessageSquarePlus}
          title="No prompts yet"
          description="Create a prompt template or reset defaults from the API"
        />
      )}

      <div className="flex flex-col gap-3">
        {prompts.map((prompt) => (
          <PromptCard key={prompt.id} prompt={prompt} />
        ))}
      </div>
    </div>
  );
}
