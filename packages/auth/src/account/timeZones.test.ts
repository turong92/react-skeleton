import { describe, expect, it } from 'vitest'
import { supportedTimeZones, withCurrent } from './timeZones'

describe('supportedTimeZones', () => {
  it('lists IANA zones, always including UTC and Asia/Seoul, sorted without duplicates', () => {
    const zones = supportedTimeZones()
    expect(zones).toContain('UTC')
    expect(zones).toContain('Asia/Seoul')
    expect(new Set(zones).size).toBe(zones.length)
    expect([...zones].sort()).toEqual(zones)
  })
})

describe('withCurrent', () => {
  it('keeps a stored value that is not in the list selectable, once, first', () => {
    expect(withCurrent(['UTC'], 'Mars/Base')).toEqual(['Mars/Base', 'UTC'])
    expect(withCurrent(['UTC'], 'UTC')).toEqual(['UTC'])
    expect(withCurrent(['UTC'], null)).toEqual(['UTC'])
  })
})
