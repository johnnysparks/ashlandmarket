/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module '*.svelte' {
  import type { ComponentType } from 'svelte'
  const component: ComponentType
  export default component
}

// Build-time constants injected by vite.config.ts
declare const __BUILD_TIME__: string
declare const __GIT_SHA__: string
