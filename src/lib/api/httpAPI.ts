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

/**
 * The charger accepted the request: it answered 2xx with a body, and not a
 * `{ msg: 'error' }` one. The one success rule for every endpoint; nothing
 * reads the reply's wording to decide.
 */
export function accepted<T>(res: ApiResult<T>): res is Exclude<T, ErrorBody | null | undefined> {
  return res !== 'error' && res != null && !isErrorBody(res)
}

// The charger's web server is single-threaded, so every request waits its
// turn here and none is ever sent while another is in flight. httpAPI is the
// only way in: callers never queue a request themselves.
let lastInLine: Promise<unknown> = Promise.resolve()
let paused = false

function inTurn<T>(send: () => Promise<T>): Promise<T> {
  const turn = lastInLine.then(send)
  lastInLine = turn.catch(() => {})
  return turn
}

/**
 * Keep the charger to one caller, as while a firmware image uploads: until
 * resumeRequests(), every request, the ones already waiting their turn
 * included, resolves 'error' without being sent.
 */
export function pauseRequests(): void {
  paused = true
}

export function resumeRequests(): void {
  paused = false
}

// A reply outside 2xx resolves 'error': the status code, never the reply's
// wording, says whether the charger accepted a request.
//
// `raw: true` resolves to { status, body } for any reply instead, for the
// callers that act on why the charger refused (its status code, or the
// reason in the body). The 401/network/paused paths still resolve to the
// plain 'error' string either way, so a caller that opts in only needs to
// check `res === 'error'` before reading `res.status`.
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
  const data: RequestInit = {
    method,
    // X-Requested-With is required by the firmware CSRF guard on cookie-authed
    // mutations; a cross-origin form cannot set it. Harmless on GETs.
    headers: { 'Content-Type': content_type, 'X-Requested-With': 'OpenEVSE' },
  }
  if (body) data.body = body
  if (import.meta.env.DEV) {
    if (!url.includes('http', 0)) url = '/api' + url
  }
  return inTurn(async (): Promise<ApiResult<T | RawResponse<T>>> => {
    if (paused) return 'error'
    // Every request gives up `timeout` after it is sent, the first included.
    // (The first was once exempt so a browser's Basic-auth prompt could wait
    // on the user, but the firmware answers this app's X-Requested-With
    // requests with a plain 401, never that prompt, and the exemption left
    // the loader up for good when a charger accepted the connection and then
    // went quiet.)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    return fetch(url, { ...data, signal: controller.signal })
      .then(async (response): Promise<T | RawResponse<T> | 'error'> => {
        // Session expired / not logged in: send the user to the login page.
        // Login.svelte posts to /login with a bare fetch (not httpAPI), so this
        // interceptor never fires during the login request itself.
        if (response.status === 401) {
          redirect('/login')
          return 'error'
        }
        if (!raw && !response.ok) return 'error'
        const parsed = (type === 'json' ? await response.json() : await response.text()) as T
        return raw ? { status: response.status, body: parsed } : parsed
      })
      .catch((error: unknown) => {
        console.log(error)
        return 'error' as const
      })
      .finally(() => clearTimeout(timer))
  })
}
