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
    onchange = () => {},
  }: Props = $props()

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

<input
  type="number"
  {min}
  {max}
  {step}
  {placeholder}
  {disabled}
  value={draft}
  oninput={(e) => (draft = e.currentTarget.value)}
  onfocus={() => (focused = true)}
  onchange={emit}
  onblur={emit}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         placeholder:text-text-dim focus:border-accent focus:outline-none
         disabled:opacity-40"
/>
