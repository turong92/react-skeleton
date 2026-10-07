import { describe, expect, it } from 'vitest'
import { foldDuration } from './duration'

describe('foldDuration — a wait folded to the largest unit that reads naturally, rounded up', () => {
  it('seconds under a minute, minutes under an hour, hours under a day, then days', () => {
    expect(foldDuration(1)).toEqual({ unit: 'second', value: 1 })
    expect(foldDuration(59)).toEqual({ unit: 'second', value: 59 })
    expect(foldDuration(60)).toEqual({ unit: 'minute', value: 1 })
    expect(foldDuration(120)).toEqual({ unit: 'minute', value: 2 })
    expect(foldDuration(3600)).toEqual({ unit: 'hour', value: 1 })
    expect(foldDuration(86_400)).toEqual({ unit: 'day', value: 1 })
    expect(foldDuration(30 * 86_400)).toEqual({ unit: 'day', value: 30 })
  })

  it('rounds up (never promises a shorter wait) and never shows 60 minutes or 24 hours', () => {
    expect(foldDuration(61)).toEqual({ unit: 'minute', value: 2 })
    expect(foldDuration(3599)).toEqual({ unit: 'hour', value: 1 })
    expect(foldDuration(3601)).toEqual({ unit: 'hour', value: 2 })
    expect(foldDuration(86_399)).toEqual({ unit: 'day', value: 1 })
  })

  it('a zero, negative or non-finite wait is at least one second', () => {
    expect(foldDuration(0)).toEqual({ unit: 'second', value: 1 })
    expect(foldDuration(-5)).toEqual({ unit: 'second', value: 1 })
    expect(foldDuration(Number.NaN)).toEqual({ unit: 'second', value: 1 })
  })
})
