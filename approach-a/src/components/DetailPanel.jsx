import { useEffect, useState } from 'react'
import { loadParcelDetail } from '../utils/data'

export default function DetailPanel({ parcel, onClose, onCompare, isInCompare }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!parcel) return
    setLoading(true)
    setDetail(null)
    loadParcelDetail(parcel.account).then(d => {
      setDetail(d)
      setLoading(false)
    })
  }, [parcel?.account])

  if (!parcel) return null

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <h2>{parcel.address || `Parcel ${parcel.account}`}</h2>
          <span className="detail-account">Account: {parcel.account}</span>
        </div>
        <div className="detail-actions">
          {onCompare && (
            <button
              className={`compare-btn ${isInCompare ? 'active' : ''}`}
              onClick={() => onCompare(parcel)}
              disabled={isInCompare}
            >
              {isInCompare ? 'In Compare' : '+ Compare'}
            </button>
          )}
          <button className="detail-close" onClick={onClose}>&times;</button>
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-stats">
          <StatCard label="$/sqft" value={parcel.price_per_sqft ? `$${Math.round(parcel.price_per_sqft)}` : 'N/A'} />
          <StatCard label="$/sqft Lot" value={parcel.price_per_sqft_lot ? `$${Math.round(parcel.price_per_sqft_lot)}` : 'N/A'} />
          <StatCard label="Last Sale" value={parcel.last_sale_price ? `$${(parcel.last_sale_price / 1000).toFixed(0)}k` : 'N/A'} />
          <StatCard label="Assessed" value={parcel.assessed_value ? `$${(parcel.assessed_value / 1000).toFixed(0)}k` : 'N/A'} />
          <StatCard label="Year Built" value={parcel.year_built || 'N/A'} />
          <StatCard label="Living Sqft" value={parcel.sqft_living ? parcel.sqft_living.toLocaleString() : 'N/A'} />
          <StatCard label="Lot Sqft" value={parcel.sqft_lot ? parcel.sqft_lot.toLocaleString() : 'N/A'} />
        </div>

        {loading && <div className="detail-loading">Loading details...</div>}

        {detail && (
          <>
            {detail.sales && detail.sales.length > 0 && (
              <div className="detail-section">
                <h3>Sales History</h3>
                <PriceChart sales={detail.sales} />
                <table className="sales-table">
                  <thead>
                    <tr><th>Date</th><th>Price</th><th>Type</th></tr>
                  </thead>
                  <tbody>
                    {detail.sales.map((s, i) => (
                      <tr key={i}>
                        <td>{s.date}</td>
                        <td>{s.price ? `$${s.price.toLocaleString()}` : 'N/A'}</td>
                        <td>{s.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detail.permits && detail.permits.length > 0 && (
              <div className="detail-section">
                <h3>Permits ({detail.permits.length})</h3>
                <table className="permits-table">
                  <thead>
                    <tr><th>Date</th><th>Type</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {detail.permits.map((p, i) => (
                      <tr key={i}>
                        <td>{p.date}</td>
                        <td>{p.type}</td>
                        <td><span className={`status-badge ${p.status.toLowerCase()}`}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detail.improvements && detail.improvements.length > 0 && (
              <div className="detail-section">
                <h3>Improvements</h3>
                <div className="improvements-list">
                  {detail.improvements.map((imp, i) => (
                    <div key={i} className="improvement-card">
                      <strong>{imp.type}</strong>
                      <span>{imp.sqft ? `${imp.sqft.toLocaleString()} sqft` : ''}</span>
                      <span>{imp.year_built ? `Built ${imp.year_built}` : ''}</span>
                      <span className="condition">{imp.condition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !detail && (
          <div className="detail-empty">No detailed data available for this parcel.</div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function PriceChart({ sales }) {
  const validSales = sales
    .filter(s => s.price && s.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (validSales.length < 2) return null

  const prices = validSales.map(s => s.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const range = maxPrice - minPrice || 1

  const width = 300
  const height = 120
  const padding = { top: 10, right: 10, bottom: 20, left: 10 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const points = validSales.map((s, i) => {
    const x = padding.left + (i / (validSales.length - 1)) * chartW
    const y = padding.top + chartH - ((s.price - minPrice) / range) * chartH
    return { x, y, ...s }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="price-chart">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
        <path d={pathD} fill="none" stroke="#4292c6" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#4292c6" />
            <text x={p.x} y={height - 4} textAnchor="middle" fontSize="9" fill="#666">
              {new Date(p.date).getFullYear()}
            </text>
          </g>
        ))}
        <text x={padding.left} y={padding.top + 4} fontSize="9" fill="#666">
          ${(maxPrice / 1000).toFixed(0)}k
        </text>
        <text x={padding.left} y={padding.top + chartH} fontSize="9" fill="#666">
          ${(minPrice / 1000).toFixed(0)}k
        </text>
      </svg>
    </div>
  )
}
