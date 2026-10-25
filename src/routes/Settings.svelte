<!-- src/routes/Settings.svelte -->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Card from '../lib/components/ui/Card.svelte'
  import Icon from '../lib/icons/Icon.svelte'
  import { pagesBySection, SETTINGS_LINKS } from '../lib/config/pages'
  import { config_store } from '../lib/stores/config'
  import { redirect } from '../lib/router'

  let groups = $derived(
    pagesBySection($config_store),
  )

  // Auth is "on" when a password is set (same test as the firmware and the HTTP
  // page — a blank username falls back to a default). Only then is there a
  // session to sign out of.
  let authOn = $derived(!!$config_store?.www_password)

  async function logout() {
    try {
      await fetch((import.meta.env.DEV ? '/api' : '') + '/logout', {
        method: 'POST',
        headers: { 'X-Requested-With': 'OpenEVSE' },
      })
    } finally {
      redirect('/login')
    }
  }

  const supportLinks = [
    {
      url: 'https://openev.freshdesk.com/support/solutions',
      icon: 'mdi:help-circle-outline',
      labelKey: 'config.support.knowledge_base',
    },
    {
      url: 'https://openevse.dozuki.com/',
      icon: 'mdi:book-open-variant',
      labelKey: 'config.support.guides',
    },
    {
      url: 'https://discord.com/invite/Y3ftbUd4rR',
      icon: 'mdi:forum-outline',
      labelKey: 'config.support.discord',
    },
  ]
</script>

{#snippet row(page: { route: string; icon: string; labelKey: string; descKey: string }, trailing: string)}
  <li>
    <a href="#{page.route}" class="flex items-center gap-3 py-3 text-text hover:text-accent">
      <Icon icon={page.icon} size={20} class="shrink-0 text-text-dim" />
      <span class="min-w-0 flex-1">
        <span class="block text-sm">{$_(page.labelKey)}</span>
        <span class="block text-xs text-text-dim">{$_(page.descKey)}</span>
      </span>
      <Icon icon={trailing} size={18} class="shrink-0 text-text-dim" />
    </a>
  </li>
{/snippet}

<section class="p-4 lg:mx-auto lg:w-full lg:max-w-5xl">
  <h1 class="mb-4 text-lg font-semibold text-text">{$_('config.title')}</h1>

  <div class="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4">
    {#each groups as group}
      <Card class="mb-4 p-4">
        <h2 class="mb-2 section-title">
          {$_('config.sections.' + group.section)}
        </h2>
        <ul class="divide-y divide-border">
          {#each group.pages as page}
            {@render row(page, 'mdi:chevron-right')}
          {/each}
          <!-- Rows that lead out of Settings end in an arrow, not a chevron. -->
          {#each SETTINGS_LINKS.filter((l) => l.section === group.section) as link}
            {@render row(link, 'mdi:arrow-right')}
          {/each}
        </ul>
      </Card>
    {/each}

    <Card class="mb-4 p-4 lg:col-span-2">
      <h2 class="mb-2 section-title">
        {$_('config.sections.support')}
      </h2>
      <ul class="divide-y divide-border">
        {#each supportLinks as link}
          <li>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-3 py-3 text-text hover:text-accent"
            >
              <Icon icon={link.icon} size={20} class="text-text-dim" />
              <span class="flex-1 text-sm">{$_(link.labelKey)}</span>
              <Icon icon="mdi:open-in-new" size={18} class="text-text-dim" />
            </a>
          </li>
        {/each}
      </ul>
    </Card>

    {#if authOn}
      <Card class="mb-4 p-4 lg:col-span-2">
        <button
          onclick={logout}
          class="flex w-full items-center gap-3 py-1 text-text hover:text-accent"
        >
          <Icon icon="mdi:logout" size={20} class="text-text-dim" />
          <span class="flex-1 text-left text-sm">{$_('config.logout')}</span>
        </button>
      </Card>
    {/if}
  </div>
</section>
