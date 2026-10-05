import { describe, expect, it } from 'vitest'
import { nextTabId } from './tabKeys'

const items = [{ id: 'a' }, { id: 'b', disabled: true }, { id: 'c' }, { id: 'd' }]

describe('nextTabId (roving focus for a tablist)', () => {
  it('ArrowRight moves to the next enabled tab and wraps around', () => {
    expect(nextTabId(items, 'a', 'ArrowRight')).toBe('c')
    expect(nextTabId(items, 'c', 'ArrowRight')).toBe('d')
    expect(nextTabId(items, 'd', 'ArrowRight')).toBe('a')
  })

  it('ArrowLeft moves back, skipping disabled tabs, and wraps', () => {
    expect(nextTabId(items, 'c', 'ArrowLeft')).toBe('a')
    expect(nextTabId(items, 'a', 'ArrowLeft')).toBe('d')
  })

  it('Home and End go to the first and last enabled tab', () => {
    expect(nextTabId(items, 'd', 'Home')).toBe('a')
    expect(nextTabId(items, 'a', 'End')).toBe('d')
    expect(nextTabId([{ id: 'x', disabled: true }, { id: 'y' }], 'y', 'Home')).toBe('y')
  })

  it('a vertical tablist uses ArrowUp / ArrowDown and ignores left / right', () => {
    expect(nextTabId(items, 'a', 'ArrowDown', 'vertical')).toBe('c')
    expect(nextTabId(items, 'c', 'ArrowUp', 'vertical')).toBe('a')
    expect(nextTabId(items, 'a', 'ArrowRight', 'vertical')).toBeNull()
    expect(nextTabId(items, 'a', 'ArrowDown', 'horizontal')).toBeNull()
  })

  it('other keys do nothing, and with no enabled tab there is nowhere to go', () => {
    expect(nextTabId(items, 'a', 'Enter')).toBeNull()
    expect(nextTabId(items, 'a', 'x')).toBeNull()
    expect(nextTabId([{ id: 'a', disabled: true }], 'a', 'ArrowRight')).toBeNull()
  })

  it('an unknown current id starts from the first enabled tab', () => {
    expect(nextTabId(items, 'zzz', 'ArrowRight')).toBe('a')
  })
})
