import { redirect } from '../router'
import type { ErrorBody } from './device'

/** Every call resolves to the payload or the string 'error' — never rejects. */
export type ApiResult<T> = T | 'error'

/** The `raw: true` result: the HTTP status alongside the parsed body. */
export interface RawResponse<T> {
  status: number
  body: T
}

/** True for a `{ msg: 'error' }` body, which some GETs return instead of a payload. */
export function isErrorBody(x: unknown): x is ErrorBody {
  return typeof x === 'object' && x !== null && 'msg' in x && (x as ErrorBody).msg === 'error'
}

// `raw: true` resolves to { status, body } instead of just the parsed body,
// for callers that need to tell an HTTP error apart from a successful
// response by status code rather than by matching the response text (which
// breaks silently if the server's wording ever changes). The 401/network
// error paths still resolve to the plain 'error' string either way, so a
// caller that opts in only needs to check `res === 'error'` before reading
// `res.status`.
export async function httpAPI<T = unknown>(
  method: string,
  url: string,
  body?: string | null,
  type?: 'json' | 'text',
  timeout?: number,
  opts?: { raw?: false },
): Promise<ApiResult<T>>
export async function httpAPI<T = unknown>(
  method: string,
  url: string,
  body: string | null,
  type: 'json' | 'text',
  timeout: number,
  opts: { raw: true },
): Promise<ApiResult<RawResponse<T>>>
export async function httpAPI<T = unknown>(
  method: string,
  url: string,
  body: string | null = null,
  type: 'json' | 'text' = 'json',
  timeout = 60000,
  { raw = false }: { raw?: boolean } = {},
): Promise<ApiResult<T | RawResponse<T>>> {
  const content_type =
    type === 'json'
      ? 'application/json'
      : 'application/x-www-form-urlencoded; charset=UTF-8'
  const controller = new AbortController()
  const data: RequestInit = {
    method,
    signal: controller.signal,
    // X-Requested-With is required by the firmware CSRF guard on cookie-authed
    // mutations; a cross-origin form cannot set it. Harmless on GETs.
    headers: { 'Content-Type': content_type, 'X-Requested-With': 'OpenEVSE' },
  }
  if (body) data.body = body
  // Every request gives up after `timeout`, the first included. (The first
  // was once exempt so a browser's Basic-auth prompt could wait on the user,
  // but the firmware answers this app's X-Requested-With requests with a
  // plain 401, never that prompt, and the exemption left the loader up for
  // good when a charger accepted the connection and then went quiet.)
  const timer = setTimeout(() => controller.abort(), timeout)
  if (import.meta.env.DEV) {
    if (!url.includes('http', 0)) url = '/api' + url
  }
  const res: ApiResult<T | RawResponse<T>> = await fetch(url, data)
    .then(async (response): Promise<T | RawResponse<T> | 'error'> => {
      // Session expired / not logged in: send the user to the login page.
      // Login.svelte posts to /login with a bare fetch (not httpAPI), so this
      // interceptor never fires during the login request itself.
      if (response.status === 401) {
        redirect('/login')
        return 'error'
      }
      const parsed = (type === 'json' ? await response.json() : await response.text()) as T
      return raw ? { status: response.status, body: parsed } : parsed
    })
    .catch((error: unknown) => {
      console.log(error)
      return 'error' as const
    })
    .finally(() => clearTimeout(timer))
  return res
}
