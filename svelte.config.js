import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
  // Required for <script lang="ts"> in components.
  preprocess: vitePreprocess(),
}
