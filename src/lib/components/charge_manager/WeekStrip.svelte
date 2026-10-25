<script lang="ts">
  // The week as the schedule runs it: one row per day, filled where the
  // charger may charge, empty where a rule has switched it off. Rules only
  // say when they start; this is where the gaps between them show.
  import { _, locale } from 'svelte-i18n'
  import { formatClock, formatHour } from '../../format/clock'
  import type { WeekDay, WeekKind } from '../../charge_manager/week'

  interface Props {
    week: WeekDay[]
    /** The charger's own day and minute, for the "now" marker. */
    now?: { day: string; minutes: number } | null
  }
  let { week, now = null }: Props = $props()

  const pct = (minutes: number): string => `${(minutes / 1440) * 100}%`
  const clock = (minutes: number): string =>
    formatClock(`${Math.floor(minutes / 60) % 24}:${String(minutes % 60).padStart(2, '0')}`, $locale)

  let hasEco = $derived(week.some((d) => d.segments.some((s) => s.kind === 'eco')))

  function describe(d: WeekDay): string {
    const spans = d.segments.map((s) =>
      $_('charge_manager.week.span', {
        values: { kind: $_(`charge_manager.week.${s.kind}`), from: clock(s.start), to: clock(s.end) },
      }),
    )
    return `${$_('days.' + d.day)}: ${spans.join(', ')}`
  }

  const fill: Record<Exclude<WeekKind, 'off'>, string> = {
    on: 'bg-accent',
    // Stripes as well as a lighter tone, so solar-only reads without colour.
    eco: 'bg-[repeating-linear-gradient(135deg,var(--color-accent)_0_2px,transparent_2px_5px)]',
  }
</script>

<div class="mb-3 rounded-2xl bg-surface-2 p-3">
  <div aria-hidden="true">
    <!-- Hour axis, aligned with the bars below -->
    <div class="relative mb-1 ml-10 h-4 text-[11px] text-text-dim">
      {#each [0, 6, 12, 18, 24] as h}
        <span
          class="absolute top-0 whitespace-nowrap
                 {h === 0 ? '' : h === 24 ? '-translate-x-full' : '-translate-x-1/2'}"
          style:left={pct(h * 60)}>{formatHour(h % 24, $locale)}</span
        >
      {/each}
    </div>

    {#each week as d (d.day)}
      {@const today = now?.day === d.day}
      <div data-day={d.day} class="flex h-6 items-center gap-2">
        <span class="w-8 shrink-0 text-xs {today ? 'font-semibold text-text' : 'text-text-dim'}">
          {$_('days.' + d.day).slice(0, 3)}
        </span>
        <div class="relative h-3.5 flex-1 rounded-sm bg-surface-3">
          {#each [6, 12, 18] as h}
            <span class="absolute inset-y-0 w-px bg-surface-2" style:left={pct(h * 60)}></span>
          {/each}
          {#each d.segments as s}
            {#if s.kind !== 'off'}
              <span
                data-kind={s.kind}
                class="absolute inset-y-0 rounded-sm {fill[s.kind]}"
                style:left={pct(s.start)}
                style:width={pct(s.end - s.start)}
              ></span>
            {/if}
          {/each}
          {#if today && now}
            <span
              data-now
              class="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-text"
              style:left={pct(now.minutes)}
            ></span>
          {/if}
        </div>
      </div>
    {/each}

    <!-- Legend -->
    <div class="mt-2 ml-10 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-4 rounded-sm {fill.on}"></span>{$_('charge_manager.week.on')}
      </span>
      {#if hasEco}
        <span class="flex items-center gap-1.5">
          <span class="h-2.5 w-4 rounded-sm {fill.eco}"></span>{$_('charge_manager.week.eco')}
        </span>
      {/if}
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-4 rounded-sm bg-surface-3"></span>{$_('charge_manager.week.off')}
      </span>
      {#if now}
        <span class="flex items-center gap-1.5">
          <span class="h-3 w-0.5 rounded-full bg-text"></span>{$_('charge_manager.week.now')}
        </span>
      {/if}
    </div>
  </div>

  <ul class="sr-only" aria-label={$_('charge_manager.week.title')}>
    {#each week as d (d.day)}
      <li>{describe(d)}</li>
    {/each}
  </ul>
</div>
