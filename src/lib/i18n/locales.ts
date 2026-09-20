// Locales the UI ships, with their native display names for the picker.
// Kept separate from index.ts so consumers can read it without pulling in
// svelte-i18n's register()/init() side effects.
export const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  hu: 'Magyar',
}
