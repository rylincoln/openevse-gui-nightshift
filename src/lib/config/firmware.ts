// src/lib/config/firmware.ts
// GitHub firmware-release helpers for the Firmware page.
import { compareVersion } from '../utils'

const RELEASES_URL =
  'https://api.github.com/repos/OpenEVSE/ESP32_WiFi_V4.x/releases'

export interface GitHubAsset {
  name: string
  browser_download_url?: string
}

export interface GitHubRelease {
  tag_name: string
  name?: string
  prerelease: boolean
  assets: GitHubAsset[]
}

export interface ReleaseChannels {
  release: GitHubRelease | null
  prerelease: GitHubRelease | null
  daily: GitHubRelease | null
}

/** Fetch the GitHub releases. Returns [] on any failure (never throws). */
export async function fetchReleases(): Promise<GitHubRelease[]> {
  try {
    const res = await fetch(RELEASES_URL)
    if (!res.ok) return []
    const data: unknown = await res.json()
    return Array.isArray(data) ? (data as GitHubRelease[]) : []
  } catch {
    return []
  }
}

/** Split releases into the stable / pre-release / daily channels. */
export function classifyReleases(releases: unknown): ReleaseChannels {
  const list = Array.isArray(releases) ? (releases as GitHubRelease[]) : []
  return {
    release: list.find((r) => r && r.prerelease === false) ?? null,
    prerelease:
      list.find(
        (r) => r && r.prerelease === true && /^v\d+\.\d+/.test(r.tag_name ?? ''),
      ) ?? null,
    daily: list.find((r) => r && r.tag_name === 'latest') ?? null,
  }
}

/** The release asset whose name starts with buildenv and ends with .bin. */
export function findAsset(
  release: GitHubRelease | null | undefined,
  buildenv: string | undefined | null,
): GitHubAsset | null {
  if (!release || !Array.isArray(release.assets) || !buildenv) return null
  return (
    release.assets.find(
      (a) =>
        a &&
        typeof a.name === 'string' &&
        a.name.startsWith(buildenv) &&
        a.name.endsWith('.bin'),
    ) ?? null
  )
}

/** True only when `latestName` is a strictly newer parseable version. */
export function updateAvailable(
  latestName: string | undefined | null,
  installedVersion: string | undefined | null,
): boolean {
  if (!latestName || !installedVersion) return false
  try {
    return compareVersion(latestName, installedVersion) === 1
  } catch {
    return false
  }
}
