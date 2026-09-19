// Ambient declarations for things the checker cannot see on its own.

// Injected at build time by vite.config.js `define`; read by the About and
// Firmware settings pages.
declare const __APP_VERSION__: string

// promise-batching-queue ships no types and has no @types package. This is
// exactly the surface src/lib/queue uses, nothing more.
declare module 'promise-batching-queue' {
  export interface SerialQueue {
    queue<T>(fn: () => T | Promise<T>): Promise<T>
  }
  export const PromiseBatcher: {
    newSerialQueue(): SerialQueue
  }
}
