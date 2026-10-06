import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import {
  consentRequestsOf,
  isReconsentExcluded,
  isSignUpComplete,
  missingFromError,
  pickDocuments,
  rowsFromMissing,
  signUpRows,
} from './consentLogic'
import type { LegalDocumentSummary } from './types'

const doc = (over: Partial<LegalDocumentSummary>): LegalDocumentSummary => ({
  type: 'terms',
  locale: 'ko',
  version: '2026-10-01',
  effectiveFrom: '2026-10-01T00:00:00Z',
  title: '이용약관',
  sha256: 'x',
  required: true,
  requiredAtSignUp: true,
  template: false,
  next: null,
  ...over,
})
const documents = [
  doc({}),
  doc({ locale: 'en', title: 'Terms of Service' }),
  doc({ type: 'privacy', title: '개인정보 처리방침' }),
  doc({ type: 'privacy', locale: 'en', title: 'Privacy Policy' }),
  doc({
    type: 'marketing',
    title: '마케팅 정보 수신 동의',
    required: false,
    requiredAtSignUp: false,
    locale: 'ko',
    version: 'v3',
  }),
]

describe('pickDocuments — one entry per type, in the reader’s language when there is one', () => {
  it('prefers the locale (also from a region tag), keeps the order of types', () => {
    expect(pickDocuments(documents, 'en-US').map((d) => [d.type, d.locale])).toEqual([
      ['terms', 'en'],
      ['privacy', 'en'],
      ['marketing', 'ko'],
    ])
  })
  it('a type that lacks the locale falls back to the fallback locale, then to the first entry', () => {
    expect(pickDocuments(documents, 'ja', 'ko').map((d) => d.locale)).toEqual(['ko', 'ko', 'ko'])
    expect(pickDocuments(documents, 'ja').map((d) => d.locale)).toEqual(['ko', 'ko', 'ko'])
  })
})

describe('sign-up consent rows', () => {
  const rows = signUpRows(pickDocuments(documents, 'ko'))

  it('required-at-sign-up documents are required rows, the rest are optional unchecked boxes', () => {
    expect(rows.map((r) => [r.type, r.kind])).toEqual([
      ['terms', 'required'],
      ['privacy', 'required'],
      ['marketing', 'optional'],
    ])
  })

  it('a required document that is not needed at sign-up is offered as an optional box (it is asked for after sign-in otherwise)', () => {
    const later = signUpRows([doc({ type: 'age', requiredAtSignUp: false, required: true })])
    expect(later[0].kind).toBe('optional')
  })

  it('the request lists every ticked document with the version and locale the user was shown — and only those', () => {
    expect(consentRequestsOf(rows, { terms: true, privacy: true, marketing: false })).toEqual([
      { type: 'terms', version: '2026-10-01', locale: 'ko' },
      { type: 'privacy', version: '2026-10-01', locale: 'ko' },
    ])
    expect(consentRequestsOf(rows, { terms: true, privacy: true, marketing: true })[2]).toEqual({
      type: 'marketing',
      version: 'v3',
      locale: 'ko',
    })
  })

  it('complete means every required row is ticked (the form must not submit otherwise)', () => {
    expect(isSignUpComplete(rows, { terms: true })).toBe(false)
    expect(isSignUpComplete(rows, { terms: true, privacy: true })).toBe(true)
    expect(isSignUpComplete([], {})).toBe(true)
  })
})

describe('re-consent', () => {
  const missing = [
    { type: 'terms', version: '2026-12-01', reason: 'STALE' as const },
    { type: 'privacy', version: '2026-10-01', reason: 'NOT_AGREED' as const },
    { type: 'ghost', version: null, reason: 'UNKNOWN' as const },
  ]
  const forbidden = (code: string, data?: unknown) =>
    new ApiRequestError(
      { code, title: code, status: 403, timestamp: 't', data },
      'trace',
      'span',
      'tp',
    )

  it('reads the missing list from a 403 LEGAL.RECONSENT_REQUIRED, and from nothing else', () => {
    expect(missingFromError(forbidden('LEGAL.RECONSENT_REQUIRED', { missing }))).toEqual(missing)
    expect(missingFromError(forbidden('LEGAL.RECONSENT_REQUIRED'))).toEqual([])
    expect(missingFromError(forbidden('COMMON.FORBIDDEN'))).toBeNull()
    expect(missingFromError(new Error('x'))).toBeNull()
  })

  it('rows for the screen carry the version the server wants (not the one that happens to be current locally), skipping unknown types', () => {
    const rows = rowsFromMissing(missing, pickDocuments(documents, 'ko'), 'ko')
    expect(rows.map((r) => [r.type, r.version, r.title])).toEqual([
      ['terms', '2026-12-01', '이용약관'],
      ['privacy', '2026-10-01', '개인정보 처리방침'],
    ])
    expect(rows.every((r) => r.kind === 'required')).toBe(true)
  })

  it('a missing type with no listed document still gets a row (the title falls back to the type code)', () => {
    const rows = rowsFromMissing([{ type: 'age', version: 'v1', reason: 'NOT_AGREED' }], [], 'ko')
    expect(rows[0]).toMatchObject({ type: 'age', title: 'age', version: 'v1', locale: 'ko' })
  })

  it('the paths the server never blocks are never recovered either (legal, auth, account)', () => {
    for (const path of [
      '/legal/consents',
      '/auth/me',
      '/account/delete',
      '/legal/documents/terms?x=1',
    ])
      expect(isReconsentExcluded(path)).toBe(true)
    for (const path of ['/notes', '/legalese', '/accounting', '/boards/free/posts'])
      expect(isReconsentExcluded(path)).toBe(false)
  })

  it('a different legal base path is honoured', () => {
    expect(isReconsentExcluded('/policies/consents', ['/policies', '/auth', '/account'])).toBe(true)
  })
})
