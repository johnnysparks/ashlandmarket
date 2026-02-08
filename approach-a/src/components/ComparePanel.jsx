import { METRICS } from '../utils/colors'

// Stats rows to display in the comparison table
const COMPARE_ROWS = [
  { key: 'price_per_sqft', label: '$/sqft' },
  { key: 'last_sale_price', label: 'Last Sale' },
  { key: 'assessed_value', label: 'Assessed' },
  { key: 'year_built', label: 'Year Built' },
  { key: 'sqft_living', label: 'Living Sqft' },
  { key: 'sqft_lot', label: 'Lot Sqft' },
  { key: 'property_age', label: 'Age' },
  { key: 'price_vs_assessed', label: 'Sale/Assessed' },
  { key: 'improvement_ratio', label: 'Bldg/Lot Ratio' },
  { key: 'num_sales', label: 'Sales' },
  { key: 'num_permits', label: 'Permits' }
]

function formatValue(key, value) {
  if (value == null || isNaN(value)) return '--'
  const m = METRICS[key]
  if (m) return m.format(value)
  return String(value)
}

export default function ComparePanel({ parcels, metric, onRemove, onClear, onClose, onSelect }) {
  if (!parcels || parcels.length === 0) return null

  // Find best value per row for highlighting
  const bestByRow = {}
  for (const row of COMPARE_ROWS) {
    const values = parcels.map(p => p[row.key]).filter(v => v != null && !isNaN(v))
    if (values.length === 0) continue
    // Higher is "better" for price metrics, lower for some others
    const higherBetter = !['property_age'].includes(row.key)
    bestByRow[row.key] = higherBetter ? Math.max(...values) : Math.min(...values)
  }

  return (
    <div className="compare-panel">
      <div className="compare-header">
        <h2>Compare Parcels</h2>
        <div className="compare-header-actions">
          <button className="compare-clear" onClick={onClear}>Clear All</button>
          <button className="detail-close" onClick={onClose}>&times;</button>
        </div>
      </div>

      <div className="compare-body">
        <div className="compare-table-wrapper">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-label-col"></th>
                {parcels.map(p => (
                  <th key={p.account} className="compare-parcel-col">
                    <div className="compare-parcel-header">
                      <button
                        className="compare-address"
                        onClick={() => onSelect(p)}
                        title="View details"
                      >
                        {p.address || `Parcel ${p.account}`}
                      </button>
                      <button
                        className="compare-remove"
                        onClick={() => onRemove(p.account)}
                        title="Remove from compare"
                      >
                        &times;
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(row => (
                <tr key={row.key} className={metric.key === row.key ? 'compare-active-metric' : ''}>
                  <td className="compare-label">{row.label}</td>
                  {parcels.map(p => {
                    const val = p[row.key]
                    const isBest = val != null && !isNaN(val) && bestByRow[row.key] === val && parcels.length > 1
                    return (
                      <td
                        key={p.account}
                        className={`compare-value ${isBest ? 'best' : ''}`}
                      >
                        {formatValue(row.key, val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
