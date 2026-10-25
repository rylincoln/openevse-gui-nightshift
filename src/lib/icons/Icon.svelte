<script lang="ts">
  import 'iconify-icon'

  interface Props {
    icon: string
    size?: number
    class?: string
  }
  let { icon, size = 20, class: klass = '' }: Props = $props()
</script>

<!-- Decorative: the label beside it, or the control around it, carries the name. -->
<iconify-icon icon={icon} width={size} height={size} class={klass} aria-hidden="true"></iconify-icon>
