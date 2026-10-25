<!-- src/lib/components/notifications/AdvisoryStrip.svelte -->
<script lang="ts">
  // The status page's strip for critical advisories.
  //
  // Only criticals reach here, and only unmuted ones: this is the loudest
  // thing the feature does short of the fault screen, so it has to be right
  // every time it appears or the owner learns to scroll past it.
  import { _ } from 'svelte-i18n'
  import { notification_store } from '../../stores/notifications'
  import { criticalItems, advisoryRoute, isKnownAdvisory } from '../../notifications/notifications'

  let items = $derived(criticalItems($notification_store.items))

  // Dismissal is per-set, not for the session: hiding the strip hides *these*
  // advisories, and a new critical brings it straight back. Tying it to the
  // set is what stops a dismissal from silently swallowing the next one.
  // Not persisted — a reload is a fair moment to be shown a critical again,
  // and the panel and the settings marker carry it in the meantime either way.
  let dismissedKey = $state('')
  let key = $derived(items.map((n) => n.id).join(','))
  let visible = $derived(items.length > 0 && dismissedKey !== key)

  function title(id: string): string {
    return isKnownAdvisory(id) ? $_('notifications.title.' + id) : id
  }
</script>

{#if visible}
  <!-- Rows are 44 px tall so each Dismiss / View link gets a full-size tap
       target without its hit box overlapping the next row's. -->
  <div role="alert" class="mb-3 rounded-2xl border border-error/40 bg-error/10 px-3 py-1">
    <div class="flex min-h-11 items-center justify-between gap-3">
      <p class="text-sm font-semibold text-error">{$_('notifications.strip_title')}</p>
      <button
        type="button"
        onclick={() => (dismissedKey = key)}
        class="tap-target shrink-0 text-xs font-semibold text-text-dim hover:text-text"
      >
        {$_('notifications.strip_dismiss')}
      </button>
    </div>
    <ul class="flex flex-col">
      {#each items as item (item.id)}
        {@const route = advisoryRoute(item.id)}
        <li class="flex min-h-11 flex-wrap items-center justify-between gap-x-3 text-sm text-text">
          <span class="min-w-0">{title(item.id)}</span>
          {#if route}
            <a href="#{route}" class="tap-target text-xs font-semibold text-accent hover:underline">
              {$_('notifications.strip_action')}
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
