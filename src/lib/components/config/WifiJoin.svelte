<!--
  src/lib/components/config/WifiJoin.svelte

  Scan, pick or type a WiFi network, and join it. Network settings and the
  setup wizard both use it; each hands in `join`, the config write (the
  wizard writes wizard_passed first), and shows its own view once joined.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { httpAPI } from '../../api/httpAPI'
  import { normalizeNetworks, signalIcon, isSecured, type WifiNetwork } from '../../config/wifi'
  import Icon from '../../icons/Icon.svelte'
  import Button from '../ui/Button.svelte'

  interface Props {
    /** Write the join; true once the charger has accepted it. A refusal is the writer's to report. */
    join: (ssid: string, pass: string) => Promise<boolean>
    onjoined?: (ssid: string) => void
    /** Scan as soon as it shows. */
    autoScan?: boolean
  }
  let { join, onjoined = () => {}, autoScan = false }: Props = $props()

  let networks = $state<WifiNetwork[]>([])
  let scanning = $state(false)
  let scanned = $state(false)
  let scanError = $state(false)
  let selected = $state<WifiNetwork | null>(null)
  let wifiPass = $state('')
  let manual = $state(false)
  let manualSsid = $state('')
  let joining = $state(false)

  async function scanWifi(): Promise<void> {
    if (scanning) return
    scanning = true
    scanError = false
    networks = []
    selected = null
    const res = await httpAPI<WifiNetwork[]>('GET', '/scan')
    scanning = false
    scanned = true
    if (res === 'error' || !Array.isArray(res)) {
      scanError = true
      return
    }
    networks = normalizeNetworks(res)
  }

  function pickNetwork(n: WifiNetwork): void {
    selected = n
    manual = false
    wifiPass = ''
  }

  function toggleManual(): void {
    manual = !manual
    selected = null
    wifiPass = ''
  }

  async function joinSsid(ssid: string): Promise<void> {
    const normalizedSsid = ssid.trim()
    if (joining || !normalizedSsid) return
    joining = true
    const ok = await join(normalizedSsid, wifiPass)
    joining = false
    if (ok) {
      networks = []
      selected = null
      onjoined(normalizedSsid)
    }
  }

  onMount(() => {
    if (autoScan) scanWifi()
  })
</script>

<div>
  <div class="py-1">
    <Button
      label={scanning ? $_('config.network.scanning') : $_('config.network.scan')}
      variant="ghost"
      disabled={scanning}
      onclick={scanWifi}
    />
  </div>

  {#if scanError}
    <p class="py-2 text-sm text-error">{$_('config.network.scan_error')}</p>
  {:else if networks.length > 0}
    <ul class="divide-y divide-border">
      {#each networks as n (n.ssid)}
        <li>
          <button
            type="button"
            onclick={() => pickNetwork(n)}
            class="flex w-full items-center gap-3 py-2 text-left text-sm
                   {selected?.ssid === n.ssid ? 'text-accent' : 'text-text'}"
          >
            <Icon icon={signalIcon(n.rssi)} size={18} class="text-text-dim" />
            <span class="flex-1">{n.ssid}</span>
            {#if isSecured(n)}
              <Icon icon="mdi:lock-outline" size={14} class="text-text-dim" />
            {/if}
          </button>

          {#if selected?.ssid === n.ssid}
            <div class="flex items-end gap-2 pb-3 pl-7">
              {#if isSecured(n)}
                <input
                  type="password"
                  placeholder={$_('config.network.wifi_password')}
                  aria-label={$_('config.network.wifi_password')}
                  value={wifiPass}
                  oninput={(e) => (wifiPass = e.currentTarget.value)}
                  class="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2
                         text-sm text-text focus:border-accent"
                />
              {/if}
              <div class="shrink-0">
                <Button
                  label={joining ? $_('config.network.connecting_btn') : $_('config.network.connect')}
                  disabled={joining}
                  onclick={() => joinSsid(n.ssid)}
                />
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if scanned && !scanning}
    <p class="py-2 text-sm text-text-dim">{$_('config.network.scan_empty')}</p>
  {/if}

  <div class="mt-3 border-t border-border pt-4">
    <Button
      label={manual ? $_('config.network.cancel_manual') : $_('config.network.manual')}
      variant="ghost"
      disabled={joining}
      onclick={toggleManual}
    />

    {#if manual}
      <div class="mt-3 space-y-3">
        <input
          type="text"
          placeholder={$_('config.network.ssid')}
          aria-label={$_('config.network.ssid')}
          value={manualSsid}
          oninput={(e) => (manualSsid = e.currentTarget.value)}
          class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2
                 text-sm text-text focus:border-accent"
        />
        <input
          type="password"
          placeholder={$_('config.network.wifi_password')}
          aria-label={$_('config.network.wifi_password')}
          value={wifiPass}
          oninput={(e) => (wifiPass = e.currentTarget.value)}
          class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2
                 text-sm text-text focus:border-accent"
        />
        <Button
          label={joining ? $_('config.network.connecting_btn') : $_('config.network.connect')}
          disabled={joining || !manualSsid.trim()}
          onclick={() => joinSsid(manualSsid)}
        />
      </div>
    {/if}
  </div>
</div>
