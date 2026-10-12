import { isIsoDate, placeholdersOf } from '@skeleton/ui'
import { currentVersionOf } from '@skeleton/marketing'
import { describe, expect, it } from 'vitest'
import { legalFacts } from './facts'
import { legalVersions, type LegalDoc } from './documents'

const docs: LegalDoc[] = ['terms', 'privacy', 'refund']
// 약관 · 방침은 개정 이력이 있다. 환불 정책은 이번에 처음 쓴 문서라 한 판이다
const minVersions = (doc: LegalDoc) => (doc === 'refund' ? 1 : 2)
const locales = ['ko', 'en'] as const

describe.each(docs.flatMap((doc) => locales.map((locale) => [doc, locale] as const)))(
  'the %s document in %s (a TEMPLATE the owner must have reviewed)',
  (doc, locale) => {
    const versions = legalVersions(doc, locale)

    it('has its versions, with unique version labels and real effective dates', () => {
      expect(versions.length).toBeGreaterThanOrEqual(minVersions(doc))
      expect(new Set(versions.map((v) => v.version)).size).toBe(versions.length)
      for (const v of versions) expect(isIsoDate(v.effectiveDate), v.version).toBe(true)
    })

    it('says it is a TEMPLATE in every version (no version can be mistaken for reviewed legal text)', () => {
      for (const v of versions) expect(v.markdown, v.version).toMatch(/TEMPLATE/)
    })

    it('uses only placeholders the facts file fills — nothing is left as {{…}} in the published text', () => {
      for (const v of versions)
        for (const key of placeholdersOf(v.markdown))
          expect(Object.keys(legalFacts), `${doc}/${locale}/${v.version}: {{${key}}}`).toContain(
            key,
          )
    })

    it('has a current version today and sections that start with "# " (the page h1 is the title)', () => {
      expect(currentVersionOf(versions, '2026-10-06')).toBeDefined()
      for (const v of versions) {
        expect(v.markdown, v.version).toMatch(/^# /m)
        expect(
          v.markdown,
          `${v.version} must not repeat the page title as a leading h1`,
        ).not.toMatch(
          /^\s*# (Terms of Service|Privacy Policy|Refund Policy|이용약관|개인정보 처리방침|환불 정책)\s*$/m,
        )
      }
    })
  },
)

describe('the two languages describe the same versions', () => {
  it.each(docs)('%s: ko and en have the same version labels and dates', (doc) => {
    const shape = (locale: 'ko' | 'en') =>
      legalVersions(doc, locale)
        .map((v) => `${v.version}@${v.effectiveDate}`)
        .sort()
    expect(shape('ko')).toEqual(shape('en'))
  })
})

describe('legalFacts', () => {
  it('are obviously placeholders (example.com addresses) until the owner replaces them', () => {
    expect(legalFacts.contactEmail).toMatch(/@example\.com$/)
  })
})
