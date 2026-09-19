// src/lib/config/tesla.ts
// Whether the device config holds a usable set of Tesla API credentials.
import type { Config } from '../api/device'

function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '' && v !== false && v !== 0
}

export function hasTeslaCredentials(config: Partial<Config> | undefined | null): boolean {
  if (!config) return false
  return (
    present(config.tesla_access_token) &&
    present(config.tesla_refresh_token) &&
    present(config.tesla_created_at) &&
    present(config.tesla_expires_in)
  )
}
