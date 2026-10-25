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
  }

  // Status first: the rest are at least as new as the versions it reports,
  // which is what DataManager takes them to be when it mounts.
  const steps: Step[] = [
    { store: status_store, progress: 20 },
    { store: schedule_store, progress: 30 },
    { store: plan_store, progress: 40 },
    { store: config_store, progress: 60 },
    { store: override_store, progress: 80 },
    { store: claims_target_store, progress: 90 },
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
      onProgress(step.progress)
    }
    onStatus('ok')
    onLoaded()
  }

  onMount(loadData)
</script>
