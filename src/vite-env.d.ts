/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_HOST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}