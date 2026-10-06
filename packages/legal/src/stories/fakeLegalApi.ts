import { ApiRequestError } from '@skeleton/api-client'
import type { LegalApi } from '../legalApi'
import type {
  ConsentEvent,
  ConsentState,
  LegalDocument,
  LegalDocumentSummary,
  MissingConsent,
  MyConsentItem,
  MyConsents,
} from '../types'

/** 스토리 · 테스트 전용 — 백엔드 없이 도는 `LegalApi`. 계약의 오류(409 `LEGAL.VERSION_STALE` · 409 `LEGAL.WITHDRAWAL_NOT_ALLOWED` · 404)를 낸다 */

const error = (code: string, status: number, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't', data }, 'trace-fake', 's', 'p')

export type FakeLegalOptions = {
  /** 처음부터 동의가 모자라다(소셜 · 링크 첫 로그인, 새 판) */
  blocked?: boolean
  /** 서버가 이미 더 새 판을 현재로 본다 — 처음 `agree` 한 번은 409 */
  staleFirstAgree?: boolean
  /** 문서 목록이 없다(legal 모듈이 없는 백엔드) */
  noModule?: boolean | 401 | 404
  /** 문서 목록이 실패한다(네트워크) */
  documentsFail?: boolean
  /** 처음에 철회된 마케팅 */
  marketing?: 'agreed' | 'withdrawn' | 'never'
}

const iso = '2026-10-01T00:00:00Z'

const SOURCES = {
  terms:
    '# 제1조 (목적)\n\n이 약관은 **샘플 서비스**의 이용 조건을 정합니다.\n\n## 제2조\n\n- 하나\n- 둘\n\n자세한 내용은 [문의](mailto:help@example.com)로 보내 주세요.',
  privacy:
    '# 수집하는 항목\n\n이메일 주소와 표시 이름을 수집합니다.\n\n# 보관 기간\n\n계정을 삭제하면 30일 뒤 지웁니다.',
  marketing:
    '# 마케팅 정보 수신\n\n새 소식과 혜택을 이메일로 보내 드립니다. 언제든 철회할 수 있어요.',
} as const

const TITLES = {
  terms: { ko: '이용약관', en: 'Terms of Service' },
  privacy: { ko: '개인정보 처리방침', en: 'Privacy Policy' },
  marketing: { ko: '마케팅 정보 수신 동의', en: 'Marketing emails' },
} as const

export const FAKE_VERSIONS = {
  terms: '2026-10-01',
  privacy: '2026-10-01',
  marketing: 'v3',
} as const

export function createFakeLegalApi(options: FakeLegalOptions = {}): LegalApi & { calls: string[] } {
  const calls: string[] = []
  const termsVersion: string = options.staleFirstAgree ? '2026-12-01' : FAKE_VERSIONS.terms
  const current = (type: keyof typeof FAKE_VERSIONS) =>
    type === 'terms' ? termsVersion : FAKE_VERSIONS[type]

  const documents: LegalDocumentSummary[] = (['terms', 'privacy', 'marketing'] as const).flatMap(
    (type) =>
      (['ko', 'en'] as const)
        .filter((locale) => type !== 'marketing' || locale === 'ko')
        .map((locale) => ({
          type,
          locale,
          version: current(type),
          effectiveFrom: iso,
          title: TITLES[type][locale],
          sha256: 'f'.repeat(64),
          required: type !== 'marketing',
          requiredAtSignUp: type !== 'marketing',
          template: true,
          next:
            type === 'privacy'
              ? { version: '2027-01-01', effectiveFrom: '2027-01-01T00:00:00Z' }
              : null,
        })),
  )

  // 동의 기록
  const agreed = new Map<string, { version: string; at: string; source: string }>()
  const withdrawn = new Set<string>()
  const history: ConsentEvent[] = []
  const record = (type: string, version: string, action: ConsentEvent['action'], source: string) =>
    history.unshift({ type, version, action, locale: 'ko', source, at: '2026-10-02T03:04:05Z' })

  if (!options.blocked) {
    // `staleFirstAgree`: 사용자는 지난 판에 동의했고 서버는 이미 새 판(2026-12-01)이 현재다
    agreed.set('terms', {
      version: options.staleFirstAgree ? FAKE_VERSIONS.terms : current('terms'),
      at: '2026-10-02T03:04:05Z',
      source: 'sign-up',
    })
    agreed.set('privacy', {
      version: current('privacy'),
      at: '2026-10-02T03:04:05Z',
      source: 'sign-up',
    })
    record('terms', current('terms'), 'AGREED', 'sign-up')
    record('privacy', current('privacy'), 'AGREED', 'sign-up')
  }
  if (options.marketing === 'agreed' || options.marketing === 'withdrawn') {
    agreed.set('marketing', { version: 'v3', at: '2026-10-02T03:04:05Z', source: 'sign-up' })
    record('marketing', 'v3', 'AGREED', 'sign-up')
    if (options.marketing === 'withdrawn') {
      withdrawn.add('marketing')
      record('marketing', 'v3', 'WITHDRAWN', 'settings')
    }
  }

  const stateOf = (type: keyof typeof FAKE_VERSIONS): ConsentState => {
    if (withdrawn.has(type)) return 'WITHDRAWN'
    const a = agreed.get(type)
    if (!a) return 'MISSING'
    return a.version === current(type) ? 'CURRENT' : 'OUTDATED'
  }
  const mine = (): MyConsents => {
    const items: MyConsentItem[] = (['terms', 'privacy', 'marketing'] as const).map((type) => {
      const a = agreed.get(type)
      return {
        type,
        required: type !== 'marketing',
        requiredAtSignUp: type !== 'marketing',
        state: stateOf(type),
        current: {
          version: current(type),
          effectiveFrom: iso,
          locales: type === 'marketing' ? ['ko'] : ['ko', 'en'],
        },
        agreed: a ? { version: a.version, agreedAt: a.at, source: a.source } : null,
        graceUntil: null,
      }
    })
    const missing: MissingConsent[] = items
      .filter((i) => i.required && (i.state === 'MISSING' || i.state === 'OUTDATED'))
      .map((i) => ({
        type: i.type,
        version: current(i.type as keyof typeof FAKE_VERSIONS),
        reason: i.state === 'MISSING' ? 'NOT_AGREED' : 'STALE',
      }))
    return { blocked: missing.length > 0, items, missing }
  }

  return {
    calls,
    async documents() {
      calls.push('documents')
      if (options.noModule)
        throw options.noModule === 401
          ? error('COMMON.UNAUTHORIZED', 401)
          : error('COMMON.NOT_FOUND', 404)
      if (options.documentsFail) throw error('CLIENT.NETWORK_ERROR', 0)
      return documents
    },
    async document(type, read = {}) {
      calls.push(`document:${type}:${read.version ?? 'current'}:${read.locale ?? ''}`)
      if (!(type in FAKE_VERSIONS)) throw error('LEGAL.DOCUMENT_NOT_FOUND', 404)
      const key = type as keyof typeof FAKE_VERSIONS
      const version = read.version ?? current(key)
      if (version !== current(key) && version !== '2026-01-01')
        throw error('LEGAL.DOCUMENT_NOT_FOUND', 404)
      const wantedLocale = read.locale ?? 'ko'
      const locale = key === 'marketing' ? 'ko' : wantedLocale
      const doc: LegalDocument = {
        type,
        version,
        locale,
        requestedLocale: wantedLocale,
        effectiveFrom: version === '2026-01-01' ? '2026-01-01T00:00:00Z' : iso,
        current: version === current(key),
        template: true,
        title: TITLES[key][locale === 'en' ? 'en' : 'ko'],
        sha256: 'f'.repeat(64),
        required: key !== 'marketing',
        requiredAtSignUp: key !== 'marketing',
        markdown: SOURCES[key],
      }
      return doc
    },
    async myConsents() {
      calls.push('myConsents')
      if (options.noModule) throw error('COMMON.NOT_FOUND', 404)
      return mine()
    },
    async agree(consents, source) {
      calls.push(`agree:${consents.map((c) => `${c.type}@${c.version}`).join(',')}:${source ?? ''}`)
      if (
        options.staleFirstAgree &&
        termsVersion === '2026-12-01' &&
        consents.some((c) => c.type === 'terms' && c.version !== '2026-12-01')
      ) {
        throw error('LEGAL.VERSION_STALE', 409, {
          stale: [{ type: 'terms', requiredVersion: '2026-12-01' }],
        })
      }
      for (const c of consents) {
        agreed.set(c.type, {
          version: c.version,
          at: '2026-10-03T00:00:00Z',
          source: source ?? 'consent',
        })
        withdrawn.delete(c.type)
        record(c.type, c.version, 'AGREED', source ?? 'consent')
      }
      return mine()
    },
    async withdraw(type) {
      calls.push(`withdraw:${type}`)
      if (type !== 'marketing') throw error('LEGAL.WITHDRAWAL_NOT_ALLOWED', 409)
      if (agreed.has(type) && !withdrawn.has(type)) {
        withdrawn.add(type)
        record(type, 'v3', 'WITHDRAWN', 'settings')
      }
      return mine()
    },
    async history({ page = 0, size = 10 } = {}) {
      calls.push(`history:${page}`)
      const values = history.slice(page * size, page * size + size)
      return {
        values,
        pagination: {
          page,
          size,
          totalElements: history.length,
          totalPages: Math.max(1, Math.ceil(history.length / size)),
        },
        meta: { timestamp: 't' },
      } as never
    },
  }
}
