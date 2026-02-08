import { COLOR_RAMPS, METRICS } from '../utils/colors'

const VIEW_MODES = [
  { key: 'points', label: 'Points' },
  { key: 'heatmap', label: 'Heatmap' },
  { key: 'hexbin', label: 'Hexbin' }
]

export default function Controls({
  metric,
  setMetric,
  colorRamp,
  setColorRamp,
  opacity,
  setOpacity,
  dateRange,
  setDateRange,
  percentileRange,
  setPercentileRange,
  viewMode,
  setViewMode,
  sizeMetric,
  setSizeMetric,
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
            <label>View Mode</label>
            <div className="mode-options">
              {VIEW_MODES.map(m => (
                <button
                  key={m.key}
                  className={`mode-btn ${viewMode === m.key ? 'active' : ''}`}
                  onClick={() => setViewMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <label>Color Metric</label>
            <select
              value={metric.key}
              onChange={e => setMetric(METRICS[e.target.value])}
            >
              {Object.entries(METRICS).map(([key, m]) => (
                <option key={key} value={key}>{m.label}</option>
              ))}
            </select>
          </div>

          {viewMode === 'points' && (
            <div className="control-group">
              <label>Size By</label>
              <select
                value={sizeMetric ? sizeMetric.key : ''}
                onChange={e => setSizeMetric(e.target.value ? METRICS[e.target.value] : null)}
              >
                <option value="">Uniform</option>
                {Object.entries(METRICS).map(([key, m]) => (
                  <option key={key} value={key}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

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
            <label>Percentile Clamp: {percentileRange.lower}–{percentileRange.upper}</label>
            <div className="percentile-inputs">
              <span className="percentile-label">Low</span>
              <input
                type="range"
                min="0"
                max="49"
                step="1"
                value={percentileRange.lower}
                onChange={e => setPercentileRange({ ...percentileRange, lower: parseInt(e.target.value) })}
              />
              <span className="percentile-value">{percentileRange.lower}%</span>
            </div>
            <div className="percentile-inputs">
              <span className="percentile-label">High</span>
              <input
                type="range"
                min="51"
                max="100"
                step="1"
                value={percentileRange.upper}
                onChange={e => setPercentileRange({ ...percentileRange, upper: parseInt(e.target.value) })}
              />
              <span className="percentile-value">{percentileRange.upper}%</span>
            </div>
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
