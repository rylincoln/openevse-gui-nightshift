/**
 * Versioned resources: things the charger counts changes to on /status
 * (config_version, schedule_version, …), kept fresh by re-downloading when
 * the counter moves. Feed it every status frame; it downloads each resource
 * once per version, never two at a time, and when the counter moves again
 * during a download it follows up once with the latest frame, since the
 * reply may predate that change. A resource whose counter is absent from
 * the frame (firmware without the feature) is left alone. No stores, no
 * DOM: the owner supplies the table and the frames.
 */

export type Version = string | number

export interface VersionedResource<S> {
  /** The resource's counter on a frame; undefined or null when the charger has none. */
  version(status: S): Version | null | undefined
  /** Re-download from the charger, given the frame that called for it; true on success. */
  download(status: S): Promise<boolean>
}

export interface VersionedResources<S, K extends string> {
  /** Look at a status frame and download whatever it says has changed. */
  observe(status: S): void
  /** Record that these resources were just downloaded as of `status`. */
  loaded(names: K[], status: S): void
}

interface Slot<S> {
  resource: VersionedResource<S>
  /** The version the store holds, once a download for it has succeeded. */
  held: Version | undefined
  busy: boolean
  /** A frame that arrived during a download and moved the version. */
  next: S | undefined
}

export function versionedResources<S, K extends string>(
  table: Record<K, VersionedResource<S>>,
): VersionedResources<S, K> {
  const slots = new Map<K, Slot<S>>()
  for (const name of Object.keys(table) as K[]) {
    slots.set(name, { resource: table[name], held: undefined, busy: false, next: undefined })
  }

  function check(slot: Slot<S>, status: S): void {
    const v = slot.resource.version(status)
    if (v === undefined || v === null) return
    if (slot.busy) {
      slot.next = status
      return
    }
    if (v !== slot.held) void refresh(slot, v, status)
  }

  async function refresh(slot: Slot<S>, v: Version, status: S): Promise<void> {
    slot.busy = true
    const ok = await slot.resource.download(status)
    slot.busy = false
    if (ok) slot.held = v
    const next = slot.next
    slot.next = undefined
    // A frame seen during the download decides whether to go again. A failed
    // download with no newer frame waits for the next one rather than looping.
    if (next !== undefined && (ok || slot.resource.version(next) !== v)) check(slot, next)
  }

  return {
    observe(status) {
      for (const slot of slots.values()) check(slot, status)
    },
    loaded(names, status) {
      for (const name of names) {
        const slot = slots.get(name)
        const v = slot?.resource.version(status)
        if (slot && v !== undefined && v !== null) slot.held = v
      }
    },
  }
}
