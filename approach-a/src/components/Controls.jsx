import { COLOR_RAMPS, METRICS } from '../utils/colors'

export default function Controls({
  metric,
  setMetric,
  colorRamp,
  setColorRamp,
  opacity,
  setOpacity,
  dateRange,
  setDateRange,
  isOpen,
  setIsOpen
}) {
  return (
    <div className={`controls-panel ${isOpen ? 'open' : 'collapsed'}`}>
      <button className="controls-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'Hide Controls' : 'Controls'}
      </button>

      {isOpen && (
        <div className="controls-body">
          <div className="control-group">
            <label>Metric</label>
            <select
              value={metric.key}
              onChange={e => setMetric(METRICS[e.target.value])}
            >
              {Object.entries(METRICS).map(([key, m]) => (
                <option key={key} value={key}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Color Ramp</label>
            <div className="ramp-options">
              {Object.entries(COLOR_RAMPS).map(([key, ramp]) => (
                <button
                  key={key}
                  className={`ramp-swatch ${colorRamp === ramp ? 'active' : ''}`}
                  title={ramp.name}
                  onClick={() => setColorRamp(ramp)}
                  style={{
                    background: `linear-gradient(to right, ${ramp.stops.join(', ')})`
                  }}
                />
              ))}
            </div>
          </div>

          <div className="control-group">
            <label>Opacity: {Math.round(opacity * 100)}%</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={e => setOpacity(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Sale Date Range</label>
            <div className="date-range">
              <input
                type="date"
                value={dateRange.start}
                onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
              />
              <span>to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
            {(dateRange.start || dateRange.end) && (
              <button
                className="clear-dates"
                onClick={() => setDateRange({ start: '', end: '' })}
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
