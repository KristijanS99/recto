import { useState } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { InstructionsEditor } from '../components/InstructionsEditor';
import { PromptList } from '../components/PromptList';

const TABS = ['Instructions', 'Prompts'] as const;
type Tab = (typeof TABS)[number];

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('Instructions');

  useDocumentTitle('Settings');

  return (
    <div>
      <h2 className="text-2xl font-semibold text-sand-800 dark:text-sand-100 mb-6">Settings</h2>

      <div className="flex gap-1 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-sm rounded-full transition-all duration-150 ${
              activeTab === tab
                ? 'bg-sand-700 dark:bg-sand-200 text-white dark:text-sand-900'
                : 'bg-sand-100 dark:bg-sand-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-sand-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Instructions' && <InstructionsEditor />}
      {activeTab === 'Prompts' && <PromptList />}
    </div>
  );
}
