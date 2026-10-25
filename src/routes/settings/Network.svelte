<!-- src/routes/settings/Network.svelte -->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config'
  import { status_store } from '../../lib/stores/status'
  import { createConfigForm } from '../../lib/config/configForm.svelte'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import WifiJoin from '../../lib/components/config/WifiJoin.svelte'
  import { signalPercent } from '../../lib/config/wifi'

  const form = createConfigForm()
  const ss = form.saveState

  let connected = $derived(
    !!($status_store?.wifi_client_connected || $status_store?.eth_connected === 1),
  )

  // "72%" with "(-67 dBm)" as a dim suffix — falls back to the raw value if
  // it isn't a finite number.
  let signalPct = $derived(signalPercent($status_store?.srssi))
  let signal = $derived(signalPct === null ? $status_store?.srssi : `${signalPct}%`)
  let signalDetail = $derived(
    signalPct === null ? '' : `(${$status_store?.srssi} ${$_('units.dbm')})`,
  )

  // Once the charger takes the new network it leaves this one; say so
  // rather than offer the picker again.
  let joined = $state(false)

  // /status reports the network mode as a firmware code; say it in words.
  const MODE_KEYS: Record<string, string> = {
    STA: 'config.network.mode_sta',
    AP: 'config.network.mode_ap',
    'STA+AP': 'config.network.mode_sta_ap',
    Wired: 'config.network.mode_wired',
  }
  function modeLabel(mode: string | undefined): string | undefined {
    return mode && MODE_KEYS[mode] ? $_(MODE_KEYS[mode]) : mode
  }
</script>

<ConfigPage title={$_('config.pages.network')}>
  <ConfigSection title={$_('config.network.status')}>
    <ReadOnlyRow label={$_('config.network.mode')} value={modeLabel($status_store?.mode)} />
    <ReadOnlyRow label={$_('config.network.ip')} value={$status_store?.ipaddress} />
    {#if $status_store?.macaddress}
      <ReadOnlyRow label={$_('config.network.mac')} value={$status_store.macaddress} />
    {/if}
    <ReadOnlyRow
      label={$_('config.network.connected')}
      value={connected ? $_('config.connected') : $_('config.not_connected')}
      tone={connected ? 'ok' : 'error'}
    />
    {#if $config_store?.ssid}
      <ReadOnlyRow label={$_('config.network.ssid')} value={$config_store.ssid} />
      <ReadOnlyRow label={$_('config.network.signal')} value={signal} detail={signalDetail} />
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.network.wifi')}>
    {#if joined}
      <p class="py-2 text-sm text-text-dim">{$_('config.network.connecting')}</p>
    {:else}
      <WifiJoin join={(ssid, pass) => form.saveFields({ ssid, pass })} onjoined={() => (joined = true)} />
    {/if}
  </ConfigSection>

  <ConfigSection>
    <FormField label={$_('config.network.host')} status={$ss.hostname ?? 'idle'}>
      <TextInput
        value={$config_store?.hostname ?? ''}
        placeholder="openevse"
        revert={form.revert}
        onchange={(v) => form.saveField('hostname', v)}
      />
    </FormField>
  </ConfigSection>

  {#if $config_store?.wizard_passed}
    <ConfigSection title={$_('config.network.ap')}>
      <p class="mb-1 text-xs text-text-dim">{$_('config.network.apdefault')}</p>
      <FormField label={$_('config.network.apssid')} status={$ss.ap_ssid ?? 'idle'}>
        <TextInput
          value={$config_store?.ap_ssid ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('ap_ssid', v)}
        />
      </FormField>
      <FormField label={$_('config.network.appass')} status={$ss.ap_pass ?? 'idle'}>
        <PasswordInput
          value={$config_store?.ap_pass ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('ap_pass', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
