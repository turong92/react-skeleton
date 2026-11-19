import { describe, expect, it } from 'vitest'
import { isBelow, parseVersion } from './version'

describe('isBelow — versions compare as numbers, part by part', () => {
  it('1.10 is newer than 1.9 although the text sorts the other way', () => {
    expect('1.10' < '1.9').toBe(true)
    expect(isBelow('1.9', '1.10')).toBe(true)
    expect(isBelow('1.10', '1.9')).toBe(false)
    expect(isBelow('1.9.12', '1.10.0')).toBe(true)
  })

  it('missing trailing parts count as zero and equal is not below', () => {
    expect(isBelow('1.2', '1.2.0')).toBe(false)
    expect(isBelow('1.2.0', '1.2')).toBe(false)
    expect(isBelow('2', '2.0.0.0')).toBe(false)
    expect(isBelow('1.2', '1.2.1')).toBe(true)
  })

  it('a build number or a pre-release suffix on the app version is ignored', () => {
    expect(parseVersion('1.2.3+45')).toEqual([1, 2, 3])
    expect(parseVersion('2.0.0-beta.1')).toEqual([2, 0, 0])
    expect(isBelow('1.9.0+7', '1.10')).toBe(true)
  })

  it('what cannot be read never forces an update', () => {
    expect(parseVersion('')).toBeNull()
    expect(parseVersion('dev')).toBeNull()
    expect(parseVersion('1..2')).toBeNull()
    expect(parseVersion('1.2.3.4.5')).toBeNull()
    expect(isBelow('dev', '2.0')).toBe(false)
    expect(isBelow('1.0', 'soon')).toBe(false)
  })
})
