<script lang="ts">
  import { _ } from 'svelte-i18n'
  import StatChip from '../ui/StatChip.svelte'

  interface StatChipsLive {
    sessionKwh: string
    elapsed: string
    currentA: string
    temp: number | null
    tempUnit: string
    toFull?: string
  }
  interface StatChipsSummary {
    todayKwh: number
    totalKwh: number
  }
  interface Props {
    charging?: boolean
    live?: StatChipsLive
    summary?: StatChipsSummary
    sessionCost?: string | null
    currentLimited?: boolean
  }

  // `currentLimited`: load sharing is holding the current below this
  // charger's own max — say so on the number itself, so 6.0 A reads as
  // "limited" without scrolling to the card that explains why.
  // `live`/`summary` default to `{}`: the two branches that read their
  // fields are each gated on `charging`, so the empty default is never
  // actually rendered from — cast to keep that dead-default's runtime value
  // unchanged while satisfying the fully-shaped type used in the markup.
  let {
    charging = false,
    live = {} as StatChipsLive,
    summary = {} as StatChipsSummary,
    sessionCost = null,
    currentLimited = false,
  }: Props = $props()
</script>

<!-- Fixed-height band: the charging tiles are taller than the resting
     summary, so reserve their height and centre the content. This keeps the
     controls below from shifting as the state changes. The resting state
     reserves a smaller height so the summary bar isn't pinned tight against
     the ring. Pilot and voltage live on Monitoring; the one amp number here
     is what the car draws. -->
<div class="flex flex-col justify-center {charging ? 'min-h-[96px]' : 'min-h-[64px]'}">
  {#if charging}
    <div class="grid grid-cols-2 gap-2 py-2 sm:grid-cols-4">
      <StatChip value={live.sessionKwh} label={$_('dashboard.chips.session')} sub={sessionCost} />
      <StatChip
        value={live.elapsed}
        label={$_('dashboard.chips.elapsed')}
        sub={live.toFull ? $_('dashboard.vehicle.to_full', { values: { time: live.toFull } }) : null}
      />
      <StatChip
        value={`${live.currentA} A`}
        label={$_('dashboard.chips.charging_current')}
        sub={currentLimited ? $_('dashboard.loadsharing.tile_limited') : null}
        subTone="warning"
      />
      <StatChip value={`${live.temp}${$_(live.tempUnit)}`} label={$_('dashboard.chips.temp')} />
    </div>
  {:else}
    <div class="flex justify-center gap-6 rounded-xl bg-surface-2 py-2 text-[11px] text-text-dim">
      <span>{$_('dashboard.summary.today')} <b class="text-text"><span>{summary.todayKwh}</span> kWh</b></span>
      <span>{$_('dashboard.summary.total')} <b class="text-text"><span>{summary.totalKwh}</span> kWh</b></span>
    </div>
  {/if}
</div>
