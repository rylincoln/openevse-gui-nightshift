<script lang="ts">
  import { _ } from 'svelte-i18n'

  interface Props {
    wsConnected?: boolean
    evseConnected?: boolean
    error?: boolean
    /** The fault's name, shown in the banner. */
    fault?: string
    /** The dashboard's status line already says what to do; link there from elsewhere. */
    onDashboard?: boolean
  }
  let { wsConnected = true, evseConnected = true, error = false, fault = '', onDashboard = false }: Props = $props()
</script>

{#if !wsConnected}
  <div role="alert" class="bg-error/15 px-4 py-2 text-sm text-error">
    {$_('connection.lost')} — {$_('connection.lost_body')}
  </div>
{/if}
{#if !evseConnected}
  <div role="alert" class="bg-warning/15 px-4 py-2 text-sm text-warning">
    {$_('connection.evse_missing')} — {$_('connection.evse_missing_body')}
  </div>
{/if}
{#if error}
  <div role="alert" class="bg-error/15 px-4 py-2 text-sm text-error">
    {$_('connection.fault', { values: { fault } })}
    {#if !onDashboard}
      <a href="#/" class="ml-1 font-semibold underline">{$_('connection.fault_link')}</a>
    {/if}
  </div>
{/if}
