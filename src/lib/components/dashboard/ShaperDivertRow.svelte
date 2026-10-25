<script lang="ts">
  // Live shaper / solar-divert readouts for the dashboard — the at-a-glance
  // numbers that explain why the charge rate is what it is: house load and
  // the current the shaper allows when the load shaper is enabled, production
  // (or grid I/E) and the current Eco allows when divert is. Neither is the
  // charge rate itself; that is the rate pill's one number.
  import { _ } from 'svelte-i18n'
  import { status_store } from '../../stores/status'
  import { config_store } from '../../stores/config'
  import { round } from '../../utils'
  import StatChip from '../ui/StatChip.svelte'

  let shaperOn = $derived(!!$config_store?.current_shaper_enabled)
  let divertOn = $derived(!!$config_store?.divert_enabled)
  // divert_type 0 reads a solar-production feed; 1 reads grid import/export.
  let gridMode = $derived($config_store?.divert_type === 1)
  // The device flips shaper_updated false whenever the feed misses its
  // interval, so it flaps in normal operation. Fade the readouts in place
  // instead of popping an error line in and out under the panel.
  let stale = $derived($status_store?.shaper_updated === false)
</script>

{#if shaperOn || divertOn}
  <!-- mobile: 2×2 grid; desktop: one slim row so it matches the chip grid's profile -->
  <div class="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 px-3 py-2 lg:flex lg:items-center lg:justify-around">
    {#if shaperOn}
      <div class="text-center transition-opacity duration-500" class:opacity-40={stale}>
        <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.flows.house_load')}</div>
        <div class="text-xs font-bold text-text">{$status_store?.shaper_live_pwr ?? 0} W</div>
      </div>
      <div class="text-center transition-opacity duration-500" class:opacity-40={stale}>
        <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.flows.shaper_allows')}</div>
        <div class="text-xs font-bold text-text">{round($status_store?.shaper_cur ?? 0, 1)} A</div>
      </div>
    {/if}
    {#if divertOn}
      <div class="text-center">
        <div class="text-[8px] tracking-wide text-text-dim uppercase">
          {gridMode ? $_('dashboard.flows.grid') : $_('dashboard.flows.solar')}
        </div>
        <div class="text-xs font-bold text-text">{(gridMode ? $status_store?.grid_ie : $status_store?.solar) ?? 0} W</div>
      </div>
      <div class="text-center">
        <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.flows.eco_allows')}</div>
        <div class="text-xs font-bold text-text">{round($status_store?.charge_rate ?? 0, 1)} A</div>
      </div>
    {/if}
  </div>
{/if}
