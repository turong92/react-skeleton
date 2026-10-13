import { describe, expect, it } from 'vitest'
import { chooseProvider } from './provider'

describe('chooseProvider', () => {
  it('Korea pays with Toss and everywhere else with Paddle', () => {
    expect(chooseProvider({ providers: ['paddle', 'toss'], country: 'KR' })).toBe('toss')
    expect(chooseProvider({ providers: ['paddle', 'toss'], country: 'US' })).toBe('paddle')
  })

  it('a setting switches everybody to one provider', () => {
    expect(chooseProvider({ providers: ['paddle', 'toss'], country: 'KR', forced: 'paddle' })).toBe('paddle')
    expect(chooseProvider({ providers: ['paddle', 'toss'], country: 'US', forced: 'toss' })).toBe('toss')
  })

  it('falls back to the provider that exists when the preferred one is off', () => {
    expect(chooseProvider({ providers: ['toss'], country: 'US' })).toBe('toss')
    expect(chooseProvider({ providers: ['paddle'], country: 'KR' })).toBe('paddle')
    expect(chooseProvider({ providers: ['paddle'], country: 'KR', forced: 'toss' })).toBe('paddle')
  })

  it('leaves the choice to the server for an old server that lists nothing', () => {
    expect(chooseProvider({ providers: undefined, country: 'US' })).toBeUndefined()
    expect(chooseProvider({ providers: [], country: 'US' })).toBeUndefined()
  })
})
