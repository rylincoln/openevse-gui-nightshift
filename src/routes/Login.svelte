<!--
  src/routes/Login.svelte

  Standalone full-screen login. App.svelte renders this (bypassing the
  normal load/wizard/shell flow) whenever the hash route is /login, which
  the httpAPI 401 interceptor sets when a session is missing or expired.

  Posts to /login with a bare fetch (not httpAPI) so the interceptor never
  fires on the login request itself. On success the firmware sets the
  session cookie and we return to the dashboard, where the normal data
  fetch retries — now authenticated.
-->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { redirect } from '../lib/router'
  import ChargePointMark from '../assets/ChargePointMark.svelte'
  import Card from '../lib/components/ui/Card.svelte'
  import TextInput from '../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../lib/components/ui/PasswordInput.svelte'
  import Toggle from '../lib/components/ui/Toggle.svelte'
  import Button from '../lib/components/ui/Button.svelte'

  const uid = $props.id()
  // /config is behind the login, so the charger's name comes from the address
  // this page was loaded from (openevse-9cc0.local, or its IP).
  const host = typeof location !== 'undefined' ? location.hostname : ''

  let user = $state('')
  let pass = $state('')
  let remember = $state(false)
  let error = $state('')
  let busy = $state(false)

  async function submit() {
    if (busy) return
    busy = true
    error = ''
    try {
      const url = (import.meta.env.DEV ? '/api' : '') + '/login'
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'OpenEVSE',
        },
        // `now` (epoch seconds) lets a device with no clock yet — no NTP
        // reachable, no controller RTC — adopt our time so it can issue a
        // dated session cookie instead of dead-ending on "clock not set".
        body: JSON.stringify({
          user,
          pass,
          remember,
          now: Math.floor(Date.now() / 1000),
        }),
      })
      if (r.ok) {
        redirect('/')
      } else if (r.status === 429) {
        error = $_('login.locked')
      } else {
        error = $_('login.invalid')
      }
    } catch {
      error = $_('login.error')
    } finally {
      busy = false
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-bg p-4">
  <Card class="w-full max-w-sm p-6">
    <div class="mb-4 flex items-center justify-center gap-2">
      <ChargePointMark size={28} class="text-accent" />
      <span class="text-sm font-semibold text-text">{$_('app')}</span>
    </div>
    <h1 class="mb-1 text-center text-xl font-semibold text-text">
      {$_('login.title')}
    </h1>
    <p class="mb-5 break-all text-center text-sm text-text-dim">
      {host ? $_('login.subtitle_host', { values: { host } }) : $_('login.subtitle')}
    </p>

    <form
      onsubmit={(e) => {
        e.preventDefault()
        // TextInput/PasswordInput commit their value on blur (change event),
        // so blur the focused field first — otherwise Enter can submit before
        // the last-typed field registers. blur() dispatches change synchronously.
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        submit()
      }}
      class="flex flex-col gap-3"
    >
      <div class="flex flex-col gap-1">
        <label for="{uid}-user" class="text-sm text-text">{$_('login.username')}</label>
        <TextInput
          id="{uid}-user"
          name="username"
          autocomplete="username"
          value={user}
          onchange={(v) => (user = v)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <label for="{uid}-pass" class="text-sm text-text">{$_('login.password')}</label>
        <PasswordInput
          id="{uid}-pass"
          name="password"
          autocomplete="current-password"
          value={pass}
          onchange={(v) => (pass = v)}
        />
      </div>

      <label class="mt-1 flex items-center gap-2 text-sm text-text">
        <Toggle
          checked={remember}
          label={$_('login.remember')}
          onchange={(v) => (remember = v)}
        />
        {$_('login.remember')}
      </label>

      {#if error}
        <p class="text-sm text-error" role="alert">{error}</p>
      {/if}

      <div class="mt-2">
        <!-- No onclick: Enter makes the browser click this button while the
             focused field has not yet committed its value. The form's submit
             handler blurs first and is the only caller. -->
        <Button
          type="submit"
          label={$_('login.submit')}
          disabled={busy}
        />
      </div>
    </form>
  </Card>
</div>
