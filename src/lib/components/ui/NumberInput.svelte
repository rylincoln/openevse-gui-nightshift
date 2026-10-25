<!-- src/lib/components/ui/NumberInput.svelte -->
<script lang="ts">
  import { untrack } from 'svelte'

  interface Props {
    value?: number | null
    min?: number
    max?: number
    step?: number
    placeholder?: string
    disabled?: boolean
    revert?: number
    /** Shown after the number ("W", "s") and read out with the field. */
    unit?: string
    onchange?: (value: number | null) => void
  }
  let {
    value = null,
    min = undefined,
    max = undefined,
    step = 1,
    placeholder = '',
    disabled = false,
    revert = 0,
    unit = '',
    onchange = () => {},
  }: Props = $props()

  const uid = $props.id()
  const unitId = `${uid}-unit`

  let draft = $state<number | string>(untrack(() => value ?? ''))
  let focused = $state(false)

  $effect(() => {
    revert
    if (!focused) draft = value ?? ''
  })

  function emit(): void {
    focused = false
    const next = draft === '' ? null : Number(draft)
    if (next !== value) onchange(next)
  }
</script>

<div class="flex items-center gap-2">
  <input
    type="number"
    {min}
    {max}
    {step}
    {placeholder}
    {disabled}
    aria-describedby={unit ? unitId : undefined}
    value={draft}
    oninput={(e) => (draft = e.currentTarget.value)}
    onfocus={() => (focused = true)}
    onchange={emit}
    onblur={emit}
    class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
           placeholder:text-text-dim focus:border-accent
           disabled:opacity-40"
  />
  {#if unit}
    <span id={unitId} class="shrink-0 text-sm text-text-dim">{unit}</span>
  {/if}
</div>
