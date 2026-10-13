import { describe, expect, it } from 'vitest'
import { countryName } from './country'

describe('the buyer country name', () => {
  it('names a country in the screen language', () => {
    expect(countryName('KR', 'ko')).toBe('대한민국')
    expect(countryName('KR', 'en')).toBe('South Korea')
  })
})
