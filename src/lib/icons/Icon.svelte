<script lang="ts">
  import 'iconify-icon'

  interface Props {
    icon: string
    size?: number
    class?: string
  }
  let { icon, size = 20, class: klass = '' }: Props = $props()
</script>

<iconify-icon icon={icon} width={size} height={size} class={klass}></iconify-icon>
