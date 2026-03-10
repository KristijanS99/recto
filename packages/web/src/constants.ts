export const FEEDBACK_DISMISS_MS = 3000;
export const TIMELINE_PAGE_LIMIT = 10;
export const TAGS_ENTRY_LIMIT = 100;
export const TITLE_PREVIEW_LENGTH = 80;
export const SNIPPET_PREVIEW_LENGTH = 200;
export const SEARCH_MODES = ['hybrid', 'keyword', 'semantic'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];
export const SETTINGS_TABS = ['Instructions', 'Prompts'] as const;
