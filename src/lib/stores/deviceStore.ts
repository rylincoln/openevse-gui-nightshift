import type { Writable } from 'svelte/store'

/**
 * The common shape of a store that mirrors one device resource: a writable
 * (undefined until the first successful download) plus `download()`, which
 * resolves true when the store now holds fresh data. Stores with writes add
 * their own `upload`/`remove`/… on top.
 */
export interface DeviceStore<T> extends Writable<T | undefined> {
  download(): Promise<boolean>
}
