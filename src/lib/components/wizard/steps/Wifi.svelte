<!--
  src/lib/components/wizard/steps/Wifi.svelte

  The last step: scan / pick / join (WifiJoin). Scans on mount the way v2
  did, so the first-run user lands on a populated list with no extra tap.

  When the device accepts our join request it reboots into station mode
  and the gateway disappears from this AP. We don't try to follow it —
  the finish-step handoff (FinishDialog) prints the new address to
  reconnect to.
-->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config'
  import { status_store } from '../../../stores/status'
  import { createConfigForm } from '../../../config/configForm.svelte'
  import WifiJoin from '../../config/WifiJoin.svelte'

  interface Props {
    onJoined?: (ssid: string) => void
    beforeJoin?: () => Promise<void>
    /** Reachable over Ethernet, so leaving the setup hotspot won't strand the browser. */
    ethConnected?: boolean
    /** Already joined a WiFi network; the wizard offers to keep it. */
    connected?: boolean
    /** This browser is on the charger's setup hotspot, which joining turns off. */
    onDeviceAp?: boolean
  }
  let {
    onJoined = () => {},
    beforeJoin = async () => {},
    ethConnected = false,
    connected = false,
    onDeviceAp = false,
  }: Props = $props()

  // Where to reach the charger once it leaves the setup hotspot. The DHCP IP
  // isn't known ahead of time, so we show the mDNS hostname (same as
  // FinishDialog). Empty until the config has loaded a hostname.
  let displayHost = $derived(
    $config_store?.hostname ? `${$config_store.hostname}.local` : '',
  )

  const form = createConfigForm()
  let joined = $state(false)

  // Mark setup complete BEFORE joining: the join switches the charger to
  // station mode and the softAP drops, so a write issued after it may never
  // reach the charger. Doing it first means the wizard won't reappear.
  async function join(ssid: string, pass: string): Promise<boolean> {
    await beforeJoin()
    return form.saveFields({ ssid, pass })
  }

  function onjoined(ssid: string): void {
    joined = true
    onJoined(ssid)
  }
</script>

<div class="space-y-4">
  {#if connected && ($status_store?.ssid || $config_store?.ssid)}
    <!-- Already on a network: keep it (the wizard's footer button) or pick
         another below. -->
    <div class="rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <p class="text-text-dim">{$_('wizard.wifi.current')}</p>
      <p class="font-semibold text-text">
        {$status_store?.ssid || $config_store?.ssid}
      </p>
    </div>
  {:else if $config_store?.ssid}
    <!-- Saved but not joined (wrong password, out of range): say so rather
         than call it the current network. -->
    <div class="rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <p class="text-text-dim">{$_('wizard.wifi.saved')}</p>
      <p class="font-semibold text-text">{$config_store.ssid}</p>
    </div>
  {/if}

  {#if joined}
    <div class="rounded-xl border border-border bg-surface-2 p-3 text-sm text-text">
      <p>{$_('wizard.wifi.joined')}</p>
      {#if displayHost}
        <p class="mt-3 text-xs text-text-dim">
          {$_('wizard.wifi.reach_at')}
        </p>
        <p class="break-all text-sm font-semibold text-accent">http://{displayHost}</p>
      {/if}
    </div>
  {:else if ethConnected}
    <!-- Already reachable over Ethernet, so WiFi here is purely optional. No
         handoff warning — connecting won't drop this session (net_manager
         auto-stops the softAP once Connected regardless of link type, so
         there's nothing left to lose from it either way), and the wizard can
         also finish without it (see Finish button in WizardShell, unhidden
         via Wizard.svelte's ethConnected). -->
    <div class="rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <p class="font-semibold text-text">{$_('wizard.wifi.eth_title')}</p>
      <p class="mt-1 text-text-dim">{$_('wizard.wifi.eth_body')}</p>
    </div>
    <p class="text-sm text-text-dim">{$_('wizard.wifi.intro')}</p>
  {:else}
    {#if onDeviceAp}
      <!-- Heads-up before the AP hand-off: connecting ends this setup session.
           Only on the hotspot: from the home network nothing is lost. -->
      <div class="rounded-xl border border-border bg-surface-2 p-3 text-sm">
        <p class="font-semibold text-text">{$_('wizard.wifi.handoff_title')}</p>
        <p class="mt-1 text-text-dim">{$_('wizard.wifi.handoff_body')}</p>
        {#if displayHost}
          <p class="mt-2 text-xs text-text-dim">
            {$_('wizard.wifi.reach_at')}
          </p>
          <p class="break-all text-sm font-semibold text-accent">http://{displayHost}</p>
        {/if}
      </div>
    {/if}
    <p class="text-sm text-text-dim">{$_(connected ? 'wizard.wifi.intro_switch' : 'wizard.wifi.intro')}</p>

    <WifiJoin {join} {onjoined} autoScan />
  {/if}
</div>
