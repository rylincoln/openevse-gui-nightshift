<script lang="ts">
  import Icon from '../../icons/Icon.svelte'
  import type { MouseEventHandler } from 'svelte/elements'

  interface Props {
    icon: string
    size?: number
    label?: string
    disabled?: boolean
    onclick?: MouseEventHandler<HTMLButtonElement>
  }
  let { icon, size = 22, label = '', disabled = false, onclick = () => {} }: Props = $props()
</script>

<button
  type="button"
  {disabled}
  {onclick}
  aria-label={label}
  class="grid place-items-center rounded-full p-2 text-text-dim
         hover:text-text disabled:opacity-40"
>
  <Icon {icon} {size} />
</button>
