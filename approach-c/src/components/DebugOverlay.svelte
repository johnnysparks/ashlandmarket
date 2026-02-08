<script lang="ts">
  import { parcels, loadError, loadStatus } from '../store'

  let open = $state(false)

  const buildTime = __BUILD_TIME__
  const gitSha = __GIT_SHA__
  const isDev = import.meta.env.DEV
  const mode = import.meta.env.MODE
  const baseUrl = import.meta.env.BASE_URL
</script>

{#if open}
  <div class="debug-panel">
    <button class="close-btn" onclick={() => open = false}>✕</button>
    <h3>Debug Info</h3>
    <table>
      <tbody>
        <tr><td>Build</td><td>{buildTime}</td></tr>
        <tr><td>Commit</td><td><code>{gitSha}</code></td></tr>
        <tr><td>Mode</td><td>{mode} {isDev ? '(dev)' : '(prod)'}</td></tr>
        <tr><td>Base URL</td><td><code>{baseUrl}</code></td></tr>
        <tr><td>Page URL</td><td><code>{typeof location !== 'undefined' ? location.href : 'N/A'}</code></td></tr>
        <tr><td>Data status</td><td class:error={$loadError}>{$loadStatus}</td></tr>
        <tr><td>Parcels</td><td>{$parcels.length}</td></tr>
        {#if $loadError}
          <tr><td>Error</td><td class="error">{$loadError}</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
{:else}
  <button class="debug-toggle" onclick={() => open = true} title="Debug info">
    ⓘ
  </button>
{/if}

<style>
  .debug-toggle {
    position: fixed;
    bottom: 8px;
    left: 8px;
    z-index: 9999;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.3);
    background: rgba(0,0,0,0.6);
    color: #aaa;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .debug-panel {
    position: fixed;
    bottom: 8px;
    left: 8px;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.9);
    color: #ccc;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    padding: 12px;
    font-size: 11px;
    font-family: monospace;
    max-width: 400px;
    max-height: 50vh;
    overflow-y: auto;
  }

  .debug-panel h3 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: #fff;
  }

  .close-btn {
    position: absolute;
    top: 4px;
    right: 8px;
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  td {
    padding: 2px 6px;
    vertical-align: top;
  }

  td:first-child {
    color: #888;
    white-space: nowrap;
    padding-right: 12px;
  }

  code {
    background: rgba(255,255,255,0.1);
    padding: 1px 4px;
    border-radius: 3px;
    word-break: break-all;
  }

  .error {
    color: #ff6b6b;
  }
</style>
