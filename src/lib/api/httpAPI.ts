import { get } from 'svelte/store'
import { uistates_store } from '../stores/uistates.js'
import { redirect } from '../router.js'
import type { ErrorBody } from './device'

/** Every call resolves to the payload or the string 'error' — never rejects. */
export type ApiResult<T> = T | 'error'

/** True for a `{ msg: 'error' }` body, which some GETs return instead of a payload. */
export function isErrorBody(x: unknown): x is ErrorBody {
  return typeof x === 'object' && x !== null && 'msg' in x && (x as ErrorBody).msg === 'error'
}

export async function httpAPI<T = unknown>(
  method: string,
  url: string,
  body: string | null = null,
  type: 'json' | 'text' = 'json',
  timeout = 60000,
): Promise<ApiResult<T>> {
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
  // do not timeout on the first request, in case authentication is needed
  if (get(uistates_store).has_fetched) {
    setTimeout(() => controller.abort(), timeout)
  }
  if (import.meta.env.DEV) {
    if (!url.includes('http', 0)) url = '/api' + url
  }
  const res: ApiResult<T> = await (fetch(url, data)
    .then((response): Promise<T | 'error'> => {
      // Session expired / not logged in: send the user to the login page.
      // Login.svelte posts to /login with a bare fetch (not httpAPI), so this
      // interceptor never fires during the login request itself.
      if (response.status === 401) {
        redirect('/login')
        return Promise.resolve('error')
      }
      return (type === 'json' ? response.json() : response.text()) as Promise<T>
    })
    .catch((error: unknown) => {
      console.log(error)
      return 'error' as const
    }) as Promise<ApiResult<T>>
  )
  uistates_store.update((x) => {
    x.has_fetched = true
    return x
  })
  return res
}
