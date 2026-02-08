<script lang="ts">
  import { selectedParcel, selectedDetail, detailLoading } from '../store'
  import PriceChart from './PriceChart.svelte'

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  function close() {
    selectedParcel.set(null)
    selectedDetail.set(null)
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus a11y_no_noninteractive_element_interactions -->
<div class="panel-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} role="dialog" aria-modal="true" tabindex="-1">
  <div class="panel" on:click|stopPropagation on:keydown|stopPropagation role="presentation">
    <div class="panel-header">
      <div>
        <h2>{$selectedParcel?.address}</h2>
        <span class="account">Account: {$selectedParcel?.account}</span>
      </div>
      <button class="close-btn" on:click={close}>x</button>
    </div>

    {#if $detailLoading}
      <div class="loading">Loading details...</div>
    {:else if $selectedDetail}
      <div class="panel-body">
        <!-- Key Stats Grid -->
        <div class="stats-grid">
          <div class="stat">
            <span class="stat-label">Last Sale</span>
            <span class="stat-value">{fmt.format($selectedParcel?.last_sale_price ?? 0)}</span>
            <span class="stat-sub">{$selectedParcel?.last_sale_date}</span>
          </div>
          <div class="stat">
            <span class="stat-label">$/sqft</span>
            <span class="stat-value">${$selectedParcel?.price_per_sqft.toFixed(0)}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Living</span>
            <span class="stat-value">{$selectedParcel?.sqft_living.toLocaleString()}</span>
            <span class="stat-sub">sqft</span>
          </div>
          <div class="stat">
            <span class="stat-label">Lot</span>
            <span class="stat-value">{$selectedParcel?.sqft_lot.toLocaleString()}</span>
            <span class="stat-sub">sqft</span>
          </div>
          <div class="stat">
            <span class="stat-label">Built</span>
            <span class="stat-value">{$selectedParcel?.year_built}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Assessed</span>
            <span class="stat-value">{fmt.format($selectedParcel?.assessed_value ?? 0)}</span>
          </div>
        </div>

        <!-- Price Trajectory Chart -->
        {#if $selectedDetail.sales.length > 1}
          <div class="section">
            <h3>Price History</h3>
            <PriceChart sales={$selectedDetail.sales} />
          </div>
        {/if}

        <!-- Sales History Table -->
        <div class="section">
          <h3>Sales ({$selectedDetail.sales.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {#each $selectedDetail.sales as sale}
                <tr>
                  <td>{sale.date}</td>
                  <td>{fmt.format(sale.price)}</td>
                  <td class="deed-type">{sale.type}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Permits -->
        {#if $selectedDetail.permits.length > 0}
          <div class="section">
            <h3>Permits ({$selectedDetail.permits.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each $selectedDetail.permits as permit}
                  <tr>
                    <td>{permit.date}</td>
                    <td>{permit.type}</td>
                    <td>
                      <span class="status" class:final={permit.status === 'FINAL'} class:active={permit.status === 'ACTIVE' || permit.status === 'ISSUED'}>
                        {permit.status}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <!-- Improvements -->
        {#if $selectedDetail.improvements.length > 0}
          <div class="section">
            <h3>Improvements ({$selectedDetail.improvements.length})</h3>
            <div class="improvements">
              {#each $selectedDetail.improvements as imp}
                <div class="improvement">
                  <span class="imp-type">{imp.type}</span>
                  <span class="imp-detail">{imp.sqft.toLocaleString()} sqft | Built {imp.year_built}</span>
                  <span class="imp-condition">{imp.condition}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="loading">No detail data available</div>
    {/if}
  </div>
</div>

<style>
  .panel-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 30;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .panel {
    background: rgba(26, 26, 46, 0.97);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 20px;
    animation: slideUp 0.25s ease-out;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  h2 {
    font-size: 18px;
    color: #e0e0e0;
    font-weight: 700;
  }

  .account {
    font-size: 11px;
    color: #6666aa;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #a0a0c0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .loading {
    padding: 40px;
    text-align: center;
    color: #8888aa;
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .stat {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 10px;
    text-align: center;
  }

  .stat-label {
    display: block;
    font-size: 10px;
    color: #6666aa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .stat-value {
    display: block;
    font-size: 16px;
    font-weight: 700;
    color: #e0e0e0;
  }

  .stat-sub {
    display: block;
    font-size: 10px;
    color: #8888aa;
  }

  .section h3 {
    font-size: 13px;
    color: #a0a0c0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 4px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  th {
    text-align: left;
    color: #6666aa;
    font-weight: 600;
    padding: 4px 8px;
    font-size: 10px;
    text-transform: uppercase;
  }

  td {
    padding: 6px 8px;
    color: #c0c0d0;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .deed-type {
    font-size: 10px;
    color: #8888aa;
  }

  .status {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
  }

  .status.final {
    background: rgba(80, 200, 120, 0.15);
    color: #50c878;
  }

  .status.active {
    background: rgba(100, 100, 255, 0.15);
    color: #8888ff;
  }

  .improvements {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .improvement {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
  }

  .imp-type {
    font-weight: 600;
    font-size: 12px;
    color: #c0c0d0;
    min-width: 70px;
  }

  .imp-detail {
    font-size: 11px;
    color: #8888aa;
    flex: 1;
  }

  .imp-condition {
    font-size: 10px;
    color: #6666aa;
    text-transform: uppercase;
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .panel {
      max-height: 90vh;
    }
  }
</style>
