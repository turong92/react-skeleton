import { describe, expect, it } from 'vitest'
import { nextChoiceIndex } from './choiceKeys'

describe('nextChoiceIndex — arrow keys inside a group of choices (one stop in the Tab order, arrows move the choice)', () => {
  it('right and down go forward, left and up go back', () => {
    expect(nextChoiceIndex('ArrowRight', 0, 3)).toBe(1)
    expect(nextChoiceIndex('ArrowDown', 1, 3)).toBe(2)
    expect(nextChoiceIndex('ArrowLeft', 2, 3)).toBe(1)
    expect(nextChoiceIndex('ArrowUp', 1, 3)).toBe(0)
  })

  it('wraps around at both ends', () => {
    expect(nextChoiceIndex('ArrowRight', 2, 3)).toBe(0)
    expect(nextChoiceIndex('ArrowLeft', 0, 3)).toBe(2)
  })

  it('Home and End jump to the ends; other keys do nothing', () => {
    expect(nextChoiceIndex('Home', 2, 3)).toBe(0)
    expect(nextChoiceIndex('End', 0, 3)).toBe(2)
    expect(nextChoiceIndex('Enter', 1, 3)).toBeNull()
    expect(nextChoiceIndex('ArrowRight', 0, 0)).toBeNull()
  })
})
