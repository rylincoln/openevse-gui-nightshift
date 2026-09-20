<script lang="ts">
  import { onMount } from 'svelte'
  import { status_store } from '../stores/status'
  import { schedule_store } from '../stores/schedule'
  import { plan_store } from '../stores/plan'
  import { config_store } from '../stores/config'
  import { override_store } from '../stores/override'
  import { claims_target_store } from '../stores/claims_target'
  import { claims_store } from '../stores/claims'
  import { certificate_store } from '../stores/certificates'
  import { uistates_store } from '../stores/uistates'

  interface Props {
    onProgress?: (progress: number) => void
    onStatus?: (status: 'loading' | 'error' | 'ok') => void
    onLoaded?: () => void
    onError?: () => void
  }
  let { onProgress = () => {}, onStatus = () => {}, onLoaded = () => {}, onError = () => {} }: Props = $props()

  interface Step {
    store: { download(): Promise<boolean> }
    progress: number
    after?: () => void
  }

  const steps: Step[] = [
    { store: status_store, progress: 20 },
    // status_store is step 0 above and each step awaits the previous one in
    // sequence, so by the time an `after` callback below runs, status_store's
    // download has already succeeded and $status_store is populated.
    { store: schedule_store, progress: 30, after: () => ($uistates_store.schedule_version = $status_store!.schedule_version) },
    { store: plan_store, progress: 40, after: () => ($uistates_store.schedule_plan_version = $status_store!.schedule_plan_version) },
    { store: config_store, progress: 60, after: () => ($uistates_store.config_version = $status_store!.config_version) },
    { store: override_store, progress: 80, after: () => ($uistates_store.override_version = $status_store!.override_version) },
    { store: claims_target_store, progress: 90, after: () => ($uistates_store.claims_version = $status_store!.claims_version) },
    { store: claims_store, progress: 95 },
    { store: certificate_store, progress: 100 },
  ]

  async function loadData() {
    for (const step of steps) {
      onStatus('loading')
      const ok = await step.store.download()
      if (!ok) {
        onStatus('error')
        onError()
        return
      }
      step.after?.()
      onProgress(step.progress)
    }
    onStatus('ok')
    onLoaded()
  }

  onMount(loadData)
</script>
