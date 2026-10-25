<!--
  src/lib/components/wizard/steps/Security.svelte

  First-run password nudge. Setting a password is optional (the device
  stays reachable on a trusted LAN without one), but offering it here —
  as an informed choice rather than a silent default — is what addresses
  the "open by default" finding. Leaving the fields blank and pressing
  Next is the "skip" path; nothing is written.

  Credentials go through CredentialFields, which writes username + password
  together in one request and requires a username when a password is set.
  There is no separate Save button here: the wizard's Next calls commit(), so
  a typed password is never silently dropped.
-->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import CredentialFields from '../../config/CredentialFields.svelte'

  let fields = $state<ReturnType<typeof CredentialFields>>()

  /** Save what was typed; false keeps the wizard on this step. */
  export function commit(): Promise<boolean> {
    return fields ? fields.commit() : Promise.resolve(true)
  }
</script>

<div class="space-y-4">
  <p class="text-sm text-text-dim">{$_('wizard.security.intro')}</p>

  <CredentialFields bind:this={fields} showSave={false} />

  <p class="text-xs text-text-dim">{$_('wizard.security.skip_hint')}</p>
</div>
