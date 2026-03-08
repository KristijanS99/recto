import { Loader2, Save, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface PromptFormProps {
  initialName?: string;
  initialDescription?: string;
  initialContent?: string;
  isNew?: boolean;
  isPending?: boolean;
  onSave: (data: { name?: string; description: string; content: string }) => void;
  onCancel: () => void;
}

export function PromptForm({
  initialName = '',
  initialDescription = '',
  initialContent = '',
  isNew = false,
  isPending = false,
  onSave,
  onCancel,
}: PromptFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [content, setContent] = useState(initialContent);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: content drives textarea height recalculation
  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [content]);

  const canSave = isNew
    ? name.trim().length > 0 && description.trim().length > 0 && content.trim().length > 0
    : description.trim().length > 0 && content.trim().length > 0;

  const isDirty = isNew ? true : description !== initialDescription || content !== initialContent;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !isDirty) return;
    onSave({
      ...(isNew ? { name: name.trim() } : {}),
      description: description.trim(),
      content: content.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 animate-fade-in">
      {isNew && (
        <label className="block">
          <span className="block text-xs font-medium text-sand-500 dark:text-sand-400 mb-1">
            Name (slug)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="my-prompt"
            className="w-full px-3 py-2 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-900 dark:text-sand-100 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:focus:ring-sand-500 transition-shadow"
            disabled={isPending}
          />
        </label>
      )}

      <label className="block">
        <span className="block text-xs font-medium text-sand-500 dark:text-sand-400 mb-1">
          Description
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description of this prompt"
          className="w-full px-3 py-2 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-900 dark:text-sand-100 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:focus:ring-sand-500 transition-shadow"
          disabled={isPending}
        />
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-sand-500 dark:text-sand-400 mb-1">
          Content
        </span>
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="The prompt content that will be sent to the AI..."
          className="w-full min-h-[100px] px-3 py-2 rounded-lg border border-sand-200 dark:border-sand-700 bg-white dark:bg-sand-800 text-sand-900 dark:text-sand-100 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-sand-400 dark:focus:ring-sand-500 transition-shadow"
          disabled={isPending}
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSave || !isDirty || isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sand-700 dark:bg-sand-200 text-white dark:text-sand-900 text-sm font-medium hover:bg-sand-800 dark:hover:bg-sand-100 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {isNew ? 'Create' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-sand-600 dark:text-sand-400 hover:text-sand-800 dark:hover:text-sand-200 transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </form>
  );
}
