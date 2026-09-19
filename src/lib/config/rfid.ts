// src/lib/config/rfid.ts
// The device keeps registered RFID tags as one comma-separated string in
// config.rfid_storage. These helpers convert to/from a tag array.

export function parseTags(csv: unknown): string[] {
  if (!csv || typeof csv !== 'string') return []
  return csv
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

export function serializeTags(tags: string[] | undefined | null): string {
  return (tags ?? []).join(',')
}

export function addTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags : [...tags, tag]
}

export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => t !== tag)
}
