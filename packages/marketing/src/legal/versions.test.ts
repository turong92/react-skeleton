import { describe, expect, it } from 'vitest'
import { currentVersionOf, sortVersions, type LegalVersion } from './versions'

const v = (version: string, effectiveDate: string): LegalVersion => ({
  version,
  effectiveDate,
  markdown: `# ${version}`,
})
const versions = [v('1.0', '2025-01-01'), v('2.0', '2026-10-01'), v('3.0', '2027-03-01')]

describe('sortVersions', () => {
  it('newest effective date first, without changing the input', () => {
    expect(sortVersions(versions).map((x) => x.version)).toEqual(['3.0', '2.0', '1.0'])
    expect(versions[0].version).toBe('1.0')
  })
})

describe('currentVersionOf', () => {
  it('is the latest version already in effect on that day (a future one is not current yet)', () => {
    expect(currentVersionOf(versions, '2026-10-06')?.version).toBe('2.0')
    expect(currentVersionOf(versions, '2026-10-01')?.version).toBe('2.0')
    expect(currentVersionOf(versions, '2027-03-01')?.version).toBe('3.0')
  })
  it('before everything: the earliest, so a page still has something to show', () => {
    expect(currentVersionOf(versions, '2020-01-01')?.version).toBe('1.0')
  })
  it('none: undefined', () => {
    expect(currentVersionOf([], '2026-10-06')).toBeUndefined()
  })
})
