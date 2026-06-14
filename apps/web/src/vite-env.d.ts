/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string
  readonly VITE_USE_BACKEND?: string
  readonly VITE_UMAMI_ENABLED?: string
  readonly VITE_UMAMI_SRC?: string
  readonly VITE_UMAMI_WEBSITE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
