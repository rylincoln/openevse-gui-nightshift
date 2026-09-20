<script lang="ts">
  import { currentPath } from '../../router'
  import { routes, NotFound, LEGACY_ROUTES } from '../../routes'
  import { status_store } from '../../stores/status'
  import { uistates_store } from '../../stores/uistates'
  import Router from '../Router.svelte'
  import Header from './Header.svelte'
  import BottomNav from './BottomNav.svelte'
  import ConnectionBanners from './ConnectionBanners.svelte'
  import DisconnectOverlay from './DisconnectOverlay.svelte'

  let deviceName = $derived($status_store?.name || 'OpenEVSE')
  // evse_connected is the device's wire encoding of a boolean (0/1, like its
  // mqtt_connected/rapi_connected siblings) — coerce so it type-checks as the
  // boolean Header/ConnectionBanners declare; 0/1 truthiness is unchanged.
  let evseConnected = $derived(Boolean($status_store?.evse_connected ?? true))
  let wsConnected = $derived($uistates_store?.ws_connected ?? true)
  let error = $derived($uistates_store?.error ?? false)

  // Without scroll restoration, navigating between long pages (e.g. Settings
  // index → Firmware) would land the user wherever the previous page was
  // scrolled to. Reset the main scroll container's position whenever the
  // route changes.
  let mainEl: HTMLElement | undefined
  $effect(() => {
    $currentPath
    if (mainEl) mainEl.scrollTop = 0
  })
</script>

<div class="flex h-full flex-col sm:flex-row-reverse">
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <Header {deviceName} {wsConnected} {evseConnected} />
    <ConnectionBanners {wsConnected} {evseConnected} {error} />
    <!-- overflow-x-hidden: nothing in the app scrolls horizontally, so clip any
         stray wide child (charts measuring before layout, long tokens) instead
         of letting `overflow-y-auto` promote overflow-x to a bottom scrollbar.
         min-w-0 lets this column shrink in the sm+ sidebar (row) layout. -->
    <main bind:this={mainEl} class="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
      <Router {routes} fallback={NotFound} aliases={LEGACY_ROUTES} />
    </main>
  </div>
  <BottomNav path={$currentPath} {deviceName} />
</div>

<!-- Full-screen blocking scrim (z-40) that escalates after a grace period when
     the WS stays down, so users don't mistake stale readings for live data. -->
<DisconnectOverlay />
