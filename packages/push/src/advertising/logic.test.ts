import { describe, expect, it } from 'vitest'
import type { PushAdvertising } from '../types'
import { advertisingFixture } from './fixture'
import { AdvertisingBlockedError, agreementRequest, daysLeft, isOn, needsReconfirm } from './logic'

const doc = { version: 'v7', locale: 'ko' }

describe('isOn — nothing looks switched on unless the server says it can send', () => {
  it('is off for every state except an effective AGREED', () => {
    for (const state of ['EXPIRED', 'OUTDATED', 'WITHDRAWN', 'NONE'] as const) {
      const ad = advertisingFixture({ consent: { state, effective: false } })
      expect(isOn(ad, 'consent')).toBe(false)
    }
  })

  it('does not trust a state alone: AGREED without effective is off', () => {
    expect(
      isOn(advertisingFixture({ consent: { state: 'AGREED', effective: false } }), 'consent'),
    ).toBe(false)
  })

  it('night is off while advertising consent is off, even if the night event says AGREED', () => {
    const ad = advertisingFixture({
      consent: { state: 'WITHDRAWN', effective: false },
      night: { state: 'AGREED', effective: true },
    })
    expect(isOn(ad, 'night')).toBe(false)
  })
})

describe('agreementRequest — what gets recorded as the consent', () => {
  it('first consent: marketing, the version the user read, source push-settings', () => {
    const ad = advertisingFixture()
    expect(agreementRequest(ad, 'consent', doc)).toEqual({
      consents: [{ type: 'marketing', version: 'v7', locale: 'ko' }],
      source: 'push-settings',
    })
  })

  it('expired or due consent is recorded as a reconfirmation', () => {
    const expired = advertisingFixture({
      consent: { state: 'EXPIRED', expiresAt: '2026-01-01T00:00:00Z' },
    })
    const due = advertisingFixture({
      consent: { state: 'AGREED', effective: true, reconfirmDue: true },
    })
    expect(agreementRequest(expired, 'consent', doc).source).toBe('reconfirm')
    expect(agreementRequest(due, 'consent', doc).source).toBe('reconfirm')
  })

  it('night consent is its own document type and never carries the advertising consent', () => {
    const ad = advertisingFixture({ consent: { state: 'AGREED', effective: true } })
    expect(agreementRequest(ad, 'night', doc).consents).toEqual([
      { type: 'marketing-night', version: 'v7', locale: 'ko' },
    ])
  })

  it('night consent cannot be recorded without advertising consent', () => {
    for (const ad of [
      advertisingFixture(),
      advertisingFixture({ consent: { state: 'EXPIRED', effective: false } }),
    ])
      expect(() => agreementRequest(ad, 'night', doc)).toThrow(AdvertisingBlockedError)
  })
})

describe('needsReconfirm / daysLeft', () => {
  it('only an expired or due consent needs reconfirming', () => {
    expect(needsReconfirm(advertisingFixture().consent)).toBe(false)
    expect(needsReconfirm(advertisingFixture({ consent: { reconfirmDue: true } }).consent)).toBe(
      true,
    )
  })

  it('counts whole days left, rounding up, never below zero', () => {
    const now = Date.parse('2026-10-01T00:00:00Z')
    expect(daysLeft('2026-10-11T00:00:00Z', now)).toBe(10)
    expect(daysLeft('2026-10-10T12:00:00Z', now)).toBe(10)
    expect(daysLeft('2026-09-01T00:00:00Z', now)).toBe(0)
  })
})

export type { PushAdvertising }
