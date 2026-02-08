<script lang="ts">
  import { onMount } from 'svelte'
  import DeckMap from './components/DeckMap.svelte'
  import Controls from './components/Controls.svelte'
  import Tooltip from './components/Tooltip.svelte'
  import DetailPanel from './components/DetailPanel.svelte'
  import Legend from './components/Legend.svelte'
  import { loadParcels, selectedParcel } from './store'

  onMount(() => {
    loadParcels()
  })
</script>

<main>
  <DeckMap />
  <Controls />
  <Legend />
  <Tooltip />
  {#if $selectedParcel}
    <DetailPanel />
  {/if}
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    background: #1a1a2e;
    color: #e0e0e0;
  }

  main {
    width: 100vw;
    height: 100vh;
    position: relative;
  }
</style>
