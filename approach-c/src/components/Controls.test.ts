import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'
import Controls from './Controls.svelte'
import {
  selectedMetric,
  colorRamp,
  opacity,
  viewMode,
  hexRadius,
  gridCellSize,
  percentileLow,
  percentileHigh,
  timeStart,
  timeEnd,
} from '../store'

describe('Controls', () => {
  beforeEach(() => {
    selectedMetric.set('price_per_sqft')
    colorRamp.set('viridis')
    opacity.set(0.8)
    viewMode.set('scatter')
    hexRadius.set(200)
    gridCellSize.set(200)
    percentileLow.set(2)
    percentileHigh.set(98)
    timeStart.set('')
    timeEnd.set('')
  })

  it('renders the controls panel', () => {
    const { container } = render(Controls)
    expect(container.querySelector('.controls')).toBeInTheDocument()
  })

  it('renders the toggle button', () => {
    const { container } = render(Controls)
    const toggle = container.querySelector('.toggle')
    expect(toggle).toBeInTheDocument()
  })

  it('collapses when toggle is clicked', async () => {
    const { container } = render(Controls)
    const toggle = container.querySelector('.toggle') as HTMLElement
    await fireEvent.click(toggle)
    expect(container.querySelector('.controls.collapsed')).toBeInTheDocument()
    expect(container.querySelector('.controls-content')).not.toBeInTheDocument()
  })

  it('expands when toggle is clicked again', async () => {
    const { container } = render(Controls)
    const toggle = container.querySelector('.toggle') as HTMLElement
    await fireEvent.click(toggle)
    await fireEvent.click(toggle)
    expect(container.querySelector('.controls.collapsed')).not.toBeInTheDocument()
    expect(container.querySelector('.controls-content')).toBeInTheDocument()
  })

  it('renders metric selector with all 8 options', () => {
    const { container } = render(Controls)
    const select = container.querySelector('#metric-select') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.options).toHaveLength(8)
  })

  it('renders view mode buttons', () => {
    const { container } = render(Controls)
    const btnGroup = container.querySelector('.btn-group')
    expect(btnGroup).toBeInTheDocument()
    const buttons = btnGroup?.querySelectorAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons?.[0].textContent).toBe('Points')
    expect(buttons?.[1].textContent).toBe('Hexbin')
    expect(buttons?.[2].textContent).toBe('Grid')
  })

  it('updates viewMode store when mode button is clicked', async () => {
    const { container } = render(Controls)
    const buttons = container.querySelector('.btn-group')?.querySelectorAll('button')
    await fireEvent.click(buttons![1]) // Hexbin
    expect(get(viewMode)).toBe('hexagon')
  })

  it('renders color ramp selector with 5 options', () => {
    const { container } = render(Controls)
    const select = container.querySelector('#ramp-select') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.options).toHaveLength(5)
  })

  it('renders opacity slider', () => {
    const { container } = render(Controls)
    const slider = container.querySelector('#opacity-slider') as HTMLInputElement
    expect(slider).toBeInTheDocument()
    expect(slider.type).toBe('range')
  })

  it('shows hex radius slider only in hexagon mode', () => {
    // In scatter mode (default), radius slider should not exist
    const { container } = render(Controls)
    expect(container.querySelector('#radius-slider')).not.toBeInTheDocument()
  })

  it('renders hex radius slider when viewMode is hexagon', () => {
    viewMode.set('hexagon')
    const { container } = render(Controls)
    expect(container.querySelector('#radius-slider')).toBeInTheDocument()
  })

  it('shows grid cell slider only in grid mode', () => {
    // In scatter mode (default), grid slider should not exist
    const { container } = render(Controls)
    expect(container.querySelector('#grid-slider')).not.toBeInTheDocument()
  })

  it('renders grid cell slider when viewMode is grid', () => {
    viewMode.set('grid')
    const { container } = render(Controls)
    expect(container.querySelector('#grid-slider')).toBeInTheDocument()
  })

  it('renders percentile clamp sliders', () => {
    const { container } = render(Controls)
    expect(container.querySelector('#pct-low')).toBeInTheDocument()
    expect(container.querySelector('#pct-high')).toBeInTheDocument()
  })

  it('renders date range inputs', () => {
    const { container } = render(Controls)
    const dateInputs = container.querySelectorAll('input[type="date"]')
    expect(dateInputs).toHaveLength(2)
  })

  it('shows clear dates button when dates are set', async () => {
    timeStart.set('2023-01-01')
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Controls)
    const clearBtn = Array.from(container.querySelectorAll('.clear-btn'))
      .find(el => el.textContent?.includes('Clear dates'))
    expect(clearBtn).toBeInTheDocument()
  })

  it('shows reset percentile button when percentiles are non-default', async () => {
    percentileLow.set(10)
    percentileHigh.set(90)
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Controls)
    const resetBtn = Array.from(container.querySelectorAll('.clear-btn'))
      .find(el => el.textContent?.includes('Reset to full range'))
    expect(resetBtn).toBeInTheDocument()
  })
})
