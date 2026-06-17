/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for API base URL (defaults to same origin). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
