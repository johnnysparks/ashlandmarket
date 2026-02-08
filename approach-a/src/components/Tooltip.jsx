import { METRICS } from '../utils/colors'

export default function Tooltip({ parcel, point, metric }) {
  if (!parcel || !point) return null

  const x = point.x
  const y = point.y

  return (
    <div
      className="map-tooltip"
      style={{
        left: x + 12,
        top: y - 12,
        position: 'absolute',
        pointerEvents: 'none'
      }}
    >
      <div className="tooltip-title">{parcel.address || `Parcel ${parcel.account}`}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">{metric.label}:</span>
        <span className="tooltip-value">{metric.format(parcel[metric.key] ?? 0)}</span>
      </div>
      {parcel.last_sale_price && (
        <div className="tooltip-row">
          <span className="tooltip-label">Last Sale:</span>
          <span className="tooltip-value">${(parcel.last_sale_price / 1000).toFixed(0)}k</span>
        </div>
      )}
      {parcel.last_sale_date && (
        <div className="tooltip-row">
          <span className="tooltip-label">Date:</span>
          <span className="tooltip-value">{parcel.last_sale_date}</span>
        </div>
      )}
      {parcel.sqft_living && (
        <div className="tooltip-row">
          <span className="tooltip-label">Living:</span>
          <span className="tooltip-value">{parcel.sqft_living.toLocaleString()} sqft</span>
        </div>
      )}
    </div>
  )
}
