import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Controls from './Controls'
import { COLOR_RAMPS, METRICS } from '../utils/colors'

function renderControls(overrides = {}) {
  const defaultProps = {
    metric: METRICS.price_per_sqft,
    setMetric: vi.fn(),
    colorRamp: COLOR_RAMPS.viridis,
    setColorRamp: vi.fn(),
    opacity: 0.8,
    setOpacity: vi.fn(),
    dateRange: { start: '', end: '' },
    setDateRange: vi.fn(),
    percentileRange: { lower: 5, upper: 95 },
    setPercentileRange: vi.fn(),
    viewMode: 'points',
    setViewMode: vi.fn(),
    sizeMetric: null,
    setSizeMetric: vi.fn(),
    isOpen: true,
    setIsOpen: vi.fn(),
    ...overrides
  }
  return { ...render(<Controls {...defaultProps} />), props: defaultProps }
}

describe('Controls', () => {
  describe('toggle behavior', () => {
    it('shows "Hide Controls" when open', () => {
      renderControls({ isOpen: true })
      expect(screen.getByText('Hide Controls')).toBeInTheDocument()
    })

    it('shows "Controls" when collapsed', () => {
      renderControls({ isOpen: false })
      expect(screen.getByText('Controls')).toBeInTheDocument()
    })

    it('calls setIsOpen when toggle clicked', () => {
      const { props } = renderControls({ isOpen: true })
      fireEvent.click(screen.getByText('Hide Controls'))
      expect(props.setIsOpen).toHaveBeenCalledWith(false)
    })

    it('hides controls body when collapsed', () => {
      renderControls({ isOpen: false })
      expect(screen.queryByText('View Mode')).not.toBeInTheDocument()
    })
  })

  describe('view mode', () => {
    it('renders all view mode buttons', () => {
      renderControls()
      expect(screen.getByText('Points')).toBeInTheDocument()
      expect(screen.getByText('Heatmap')).toBeInTheDocument()
      expect(screen.getByText('Hexbin')).toBeInTheDocument()
    })

    it('marks current mode as active', () => {
      renderControls({ viewMode: 'heatmap' })
      expect(screen.getByText('Heatmap').classList.contains('active')).toBe(true)
      expect(screen.getByText('Points').classList.contains('active')).toBe(false)
    })

    it('calls setViewMode when button clicked', () => {
      const { props } = renderControls()
      fireEvent.click(screen.getByText('Heatmap'))
      expect(props.setViewMode).toHaveBeenCalledWith('heatmap')
    })
  })

  describe('metric selector', () => {
    it('renders a select with all metrics', () => {
      renderControls()
      const select = screen.getByDisplayValue('$/sqft')
      expect(select).toBeInTheDocument()
      expect(select.tagName).toBe('SELECT')
    })

    it('calls setMetric when changed', () => {
      const { props } = renderControls()
      const select = screen.getByDisplayValue('$/sqft')
      fireEvent.change(select, { target: { value: 'year_built' } })
      expect(props.setMetric).toHaveBeenCalledWith(METRICS.year_built)
    })
  })

  describe('size metric selector', () => {
    it('shows Size By when in points mode', () => {
      renderControls({ viewMode: 'points' })
      expect(screen.getByText('Size By')).toBeInTheDocument()
    })

    it('hides Size By when not in points mode', () => {
      renderControls({ viewMode: 'heatmap' })
      expect(screen.queryByText('Size By')).not.toBeInTheDocument()
    })

    it('calls setSizeMetric with null for Uniform', () => {
      const { props } = renderControls({ viewMode: 'points', sizeMetric: METRICS.sqft_living })
      const sizeSelect = screen.getAllByRole('combobox')[1] // second select
      fireEvent.change(sizeSelect, { target: { value: '' } })
      expect(props.setSizeMetric).toHaveBeenCalledWith(null)
    })
  })

  describe('color ramp', () => {
    it('renders ramp swatch buttons', () => {
      const { container } = renderControls()
      const swatches = container.querySelectorAll('.ramp-swatch')
      expect(swatches.length).toBe(Object.keys(COLOR_RAMPS).length)
    })

    it('calls setColorRamp when swatch clicked', () => {
      const { props, container } = renderControls()
      const swatches = container.querySelectorAll('.ramp-swatch')
      fireEvent.click(swatches[1]) // click second swatch (inferno)
      expect(props.setColorRamp).toHaveBeenCalled()
    })

    it('marks active ramp', () => {
      const { container } = renderControls({ colorRamp: COLOR_RAMPS.viridis })
      const activeSwatches = container.querySelectorAll('.ramp-swatch.active')
      expect(activeSwatches.length).toBe(1)
    })
  })

  describe('opacity slider', () => {
    it('displays current opacity percentage', () => {
      renderControls({ opacity: 0.8 })
      expect(screen.getByText('Opacity: 80%')).toBeInTheDocument()
    })

    it('calls setOpacity when changed', () => {
      const { props } = renderControls()
      const slider = screen.getByDisplayValue('0.8')
      fireEvent.change(slider, { target: { value: '0.5' } })
      expect(props.setOpacity).toHaveBeenCalledWith(0.5)
    })
  })

  describe('percentile clamp', () => {
    it('displays current percentile range', () => {
      renderControls()
      expect(screen.getByText(/5–95/)).toBeInTheDocument()
    })

    it('calls setPercentileRange when lower slider changed', () => {
      const { props } = renderControls()
      const lowerSlider = screen.getByDisplayValue('5')
      fireEvent.change(lowerSlider, { target: { value: '10' } })
      expect(props.setPercentileRange).toHaveBeenCalledWith({ lower: 10, upper: 95 })
    })

    it('calls setPercentileRange when upper slider changed', () => {
      const { props } = renderControls()
      const upperSlider = screen.getByDisplayValue('95')
      fireEvent.change(upperSlider, { target: { value: '90' } })
      expect(props.setPercentileRange).toHaveBeenCalledWith({ lower: 5, upper: 90 })
    })
  })

  describe('date range', () => {
    it('renders two date inputs', () => {
      const { container } = renderControls()
      const dateInputs = container.querySelectorAll('input[type="date"]')
      expect(dateInputs.length).toBe(2)
    })

    it('calls setDateRange when start date changed', () => {
      const { props, container } = renderControls()
      const dateInputs = container.querySelectorAll('input[type="date"]')
      fireEvent.change(dateInputs[0], { target: { value: '2023-01-01' } })
      expect(props.setDateRange).toHaveBeenCalledWith({ start: '2023-01-01', end: '' })
    })

    it('shows clear button when dates are set', () => {
      renderControls({ dateRange: { start: '2023-01-01', end: '' } })
      expect(screen.getByText('Clear dates')).toBeInTheDocument()
    })

    it('hides clear button when no dates set', () => {
      renderControls({ dateRange: { start: '', end: '' } })
      expect(screen.queryByText('Clear dates')).not.toBeInTheDocument()
    })

    it('clears dates when clear button clicked', () => {
      const { props } = renderControls({ dateRange: { start: '2023-01-01', end: '2024-01-01' } })
      fireEvent.click(screen.getByText('Clear dates'))
      expect(props.setDateRange).toHaveBeenCalledWith({ start: '', end: '' })
    })
  })
})
