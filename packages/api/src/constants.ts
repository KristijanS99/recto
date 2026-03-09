// ---------------------------------------------------------------------------
// Magic numbers & strings extracted from the codebase
// ---------------------------------------------------------------------------

/** Minimum length for RECTO_API_KEY */
export const MIN_API_KEY_LENGTH = 32;

/** Default page size for list endpoints */
export const DEFAULT_PAGE_LIMIT = 20;

/** Default result limit for search queries */
export const SEARCH_DEFAULT_LIMIT = 20;

/** Reciprocal Rank Fusion smoothing constant */
export const RRF_K = 60;

/** Default number of entries used for reflection */
export const REFLECT_DEFAULT_LIMIT = 20;

/** Maximum characters of journal context sent to the LLM for reflection */
export const MAX_CONTEXT_CHARS = 16_000;

/** Maximum words kept per entry when building reflection context */
export const MAX_ENTRY_WORDS = 500;

/** Authorization code lifetime (10 minutes) */
export const AUTH_CODE_EXPIRY_MS = 10 * 60 * 1000;

/** Interval between expired-token cleanup runs (1 hour) */
export const OAUTH_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/** Max tokens for LLM enrichment calls */
export const LLM_MAX_TOKENS_ENRICHMENT = 512;

/** Max tokens for LLM reflection calls */
export const LLM_MAX_TOKENS_REFLECT = 1024;

/** Default embedding dimensions per provider */
export const EMBEDDING_DIMENSIONS = {
  openai: 1536,
  voyageai: 1024,
  ollama: 768,
} as const;

/** Application-level error codes used in JSON error responses */
export const ERROR_CODE = {
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  HTTP_ERROR: 'HTTP_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

/** Standard HTTP status codes */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
