<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'
  import ChargePointMark from '../../../assets/ChargePointMark.svelte'

  interface Props {
    path?: string
    deviceName?: string
  }
  let { path = '/', deviceName = 'OpenEVSE' }: Props = $props()

  interface NavItem {
    href: string
    key: string
    icon: string
  }
  const items: NavItem[] = [
    { href: '/', key: 'nav.home', icon: 'mdi:home-outline' },
    { href: '/schedule', key: 'nav.charge_manager', icon: 'mdi:lightning-bolt-circle' },
    { href: '/monitoring', key: 'nav.monitoring', icon: 'mdi:chart-line' },
    { href: '/history', key: 'nav.history', icon: 'mdi:history' },
    { href: '/settings', key: 'nav.settings', icon: 'mdi:cog-outline' },
  ]

  // Highlight the parent tab while inside its sub-routes (e.g. /settings
  // *and* /settings/firmware both light up the Settings tab). The Home
  // item is the special case — '/'.startsWith('/') is true for everything,
  // so it gets a strict equality check.
  function isActive(item: NavItem, p: string): boolean {
    if (item.href === '/') return p === '/'
    return p === item.href || p.startsWith(item.href + '/')
  }
</script>

<!-- Total height = 56px button row + the home-indicator inset, with
     padding-bottom reserving exactly the inset so the buttons still
     get their full 56px. Without growing the height first, border-box
     would shrink the button area instead of pushing the bar taller.
     The sidebar layout on sm+ resets everything. -->
<nav
  class="flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-stretch border-t border-border bg-surface-2
         pb-[env(safe-area-inset-bottom)]
         pl-[env(safe-area-inset-left)]
         pr-[env(safe-area-inset-right)]
         sm:h-full sm:w-24 sm:flex-col sm:border-r sm:border-t-0
         sm:pb-0 sm:pl-0 sm:pr-0
         lg:w-52"
>
  <!-- Desktop rail brand: lives in the sidebar at lg (the header hides its
       copy there); a rule + breathing room separates it from the nav items. -->
  <div class="mb-2 hidden items-center gap-2 border-b border-border px-5 pt-5 pb-4 lg:flex">
    <ChargePointMark size={26} class="text-accent" />
    <span class="text-sm font-semibold text-text">{deviceName}</span>
  </div>
  {#each items as item}
    <a
      href="#{item.href}"
      aria-label={$_(item.key)}
      aria-current={isActive(item, path) ? 'page' : undefined}
      class="flex flex-1 flex-col items-center justify-start gap-0.5 pt-1.5 text-[10px]
             sm:flex-none sm:justify-center sm:gap-1 sm:py-4
             lg:flex-row lg:justify-start lg:gap-3 lg:px-5 lg:py-3 lg:text-sm
             {isActive(item, path) ? 'text-accent' : 'text-text-dim'}"
    >
      <Icon icon={item.icon} size={22} />
      <!-- Labels may wrap to two lines ("Charge Manager" on a phone, longer
           translations on the tablet rail), so the phone bar hangs every item
           from the same top offset and the tablet rail reserves two lines:
           either way a wrap can't knock its icon off the shared baseline. lg
           (icon beside text) keeps its single-line flow. -->
      <span
        class="text-center leading-[1.1]
               sm:max-lg:flex sm:max-lg:h-[26px] sm:max-lg:items-start sm:max-lg:justify-center
               sm:max-lg:overflow-hidden sm:max-lg:leading-tight lg:text-left lg:leading-normal"
        >{$_(item.key)}</span
      >
    </a>
  {/each}
</nav>
