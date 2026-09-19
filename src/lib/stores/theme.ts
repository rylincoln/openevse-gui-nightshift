import { writable, type Readable } from 'svelte/store'

const STORAGE_KEY = 'oevse-theme'

export type ThemeOverride = 'light' | 'dark' | null
export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeState {
  override: ThemeOverride
  resolved: ResolvedTheme
}

// Kept in sync with --surface in src/app.css. The system chrome (iOS status
// bar tint, Android task switcher) reads this from <meta name="theme-color">.
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f0f4f3', dark: '#222835' }

function syncThemeColorMeta(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  // Remove the static media-query metas baked into index.html — once we know
  // the resolved theme (including any user override) we drive a single tag.
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((node) => node.remove())
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', THEME_COLORS[resolved] || THEME_COLORS.dark)
  document.head.appendChild(meta)
}

function osPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function readOverride(): ThemeOverride {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const val: unknown = raw ? JSON.parse(raw) : null
    return val === 'light' || val === 'dark' ? val : null
  } catch {
    return null
  }
}

function resolve(override: ThemeOverride): ResolvedTheme {
  if (override) return override
  return osPrefersDark() ? 'dark' : 'light'
}

export interface ThemeStore extends Readable<ThemeState> {
  setTheme(choice: ThemeChoice): void
  init(): void
}

function createThemeStore(): ThemeStore {
  const override = readOverride()
  const { subscribe, set } = writable<ThemeState>({ override, resolved: resolve(override) })
  let current: ThemeState = { override, resolved: resolve(override) }

  function apply(state: ThemeState): void {
    current = state
    set(state)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', state.resolved)
    }
    syncThemeColorMeta(state.resolved)
  }

  function setTheme(choice: ThemeChoice): void {
    const next: ThemeOverride = choice === 'system' ? null : choice
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable — keep in-memory only */
    }
    apply({ override: next, resolved: resolve(next) })
  }

  function init(): void {
    apply(current)
    if (typeof window !== 'undefined' && window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (!current.override) apply({ override: null, resolved: resolve(null) })
        })
    }
  }

  return { subscribe, setTheme, init }
}

export const theme: ThemeStore = createThemeStore()
