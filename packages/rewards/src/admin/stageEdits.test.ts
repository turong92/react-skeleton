import { describe, expect, it } from 'vitest'
import type { CouponStage } from '../types'
import {
  addStage,
  freeMonths,
  freeVoucher,
  MAX_STAGES,
  removeStage,
  setForever,
  updateStage,
} from './stageEdits'

const pct = (value: number, periods: number | null): CouponStage => ({
  type: 'PERCENT',
  value,
  maxDiscount: null,
  periods,
})

describe('stage edits', () => {
  it('adds a stage (one payment, 10%) up to the limit', () => {
    let stages: CouponStage[] = []
    for (let i = 0; i < MAX_STAGES + 3; i++) stages = addStage(stages)
    expect(stages).toHaveLength(MAX_STAGES)
    expect(stages[0]).toEqual({ type: 'PERCENT', value: 10, maxDiscount: null, periods: 1 })
  })

  it('adding after a forever stage makes that stage finite - forever stays the last one only', () => {
    const next = addStage([pct(10, null)])
    expect(next.map((s) => s.periods)).toEqual([1, 1])
  })

  it('forever is only for the last stage', () => {
    const stages = [pct(10, 1), pct(20, 1)]
    expect(setForever(stages, 0, true)).toEqual(stages)
    expect(setForever(stages, 1, true)[1]?.periods).toBeNull()
    expect(setForever([pct(10, null)], 0, false)[0]?.periods).toBe(1)
  })

  it('updates and removes by index without touching the others', () => {
    const stages = [pct(10, 1), pct(20, 2)]
    expect(updateStage(stages, 1, { value: 30 })[1]).toMatchObject({ value: 30, periods: 2 })
    expect(updateStage(stages, 1, { value: 30 })[0]).toBe(stages[0])
    expect(removeStage(stages, 0)).toEqual([stages[1]])
  })

  it('templates fill the stages: 무료 이용권 is one free payment, n달 무료 is n free periods', () => {
    expect(freeVoucher()).toEqual([{ type: 'FREE', value: 0, maxDiscount: null, periods: 1 }])
    expect(freeMonths(3)).toEqual([{ type: 'FREE', value: 0, maxDiscount: null, periods: 3 }])
    expect(freeMonths(0)[0]?.periods).toBe(1)
    expect(freeMonths(99)[0]?.periods).toBe(36)
  })

  it('switching a stage to free clears its value and cap', () => {
    const free = updateStage([{ ...pct(10, 1), maxDiscount: 500 }], 0, { type: 'FREE' })[0]
    expect(free).toMatchObject({ type: 'FREE', value: 0, maxDiscount: null })
  })
})
