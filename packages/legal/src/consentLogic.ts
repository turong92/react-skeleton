import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { ConsentRequest, LegalDocumentSummary, MissingConsent } from './types'

/** 체크리스트 · 재동의 화면의 한 줄 — 어느 판을 어느 언어로 보여 주고 있는가 */
export type ConsentRow = {
  type: string
  version: string
  /** 사용자가 읽을 문서의 언어(요청에 그대로 실린다) */
  locale: string
  title: string
  /** `required`: 체크하지 않으면 못 간다. `optional`: 꺼진 채 시작하는 선택 상자 */
  kind: 'required' | 'optional'
  template: boolean
  effectiveFrom?: string
}

const language = (tag: string) => tag.toLowerCase().split('-')[0]

/**
 * `GET /documents` 는 (종류, 언어)마다 한 줄이다 — 종류마다 하나만 고른다: 사용자의 언어 → 앱 기본 언어(`fallback`) → 첫 줄.
 * 서버는 기본 언어를 목록에 알려 주지 않으므로(계약에 없다) 앱이 `fallback` 을 안 주면 목록의 첫 줄이 기본 언어라고 본다. 종류의 순서는 서버가 준 순서.
 */
export function pickDocuments(
  documents: readonly LegalDocumentSummary[],
  locale: string,
  fallback?: string,
): LegalDocumentSummary[] {
  const order: string[] = []
  const byType = new Map<string, LegalDocumentSummary[]>()
  for (const d of documents) {
    if (!byType.has(d.type)) {
      byType.set(d.type, [])
      order.push(d.type)
    }
    byType.get(d.type)?.push(d)
  }
  return order.flatMap((type) => {
    const list = byType.get(type) ?? []
    const wanted = [locale, fallback].filter((x): x is string => !!x).map(language)
    for (const lang of wanted) {
      const found = list.find((d) => language(d.locale) === lang)
      if (found) return [found]
    }
    return list.length > 0 ? [list[0]] : []
  })
}

const rowOf = (d: LegalDocumentSummary, kind: ConsentRow['kind']): ConsentRow => ({
  type: d.type,
  version: d.version,
  locale: d.locale,
  title: d.title,
  kind,
  template: d.template,
  effectiveFrom: d.effectiveFrom,
})

/**
 * 가입 폼의 줄 — 가입에 꼭 필요한 문서(`requiredAtSignUp`)는 필수, 나머지(마케팅 · 가입엔 필요 없지만 필수인 문서)는 꺼진 선택 상자.
 * 후자를 안 켜면 첫 로그인 뒤 재동의 화면이 묻는다(서버가 막는다).
 */
export const signUpRows = (documents: readonly LegalDocumentSummary[]): ConsentRow[] =>
  documents.map((d) => rowOf(d, d.requiredAtSignUp ? 'required' : 'optional'))

/** 체크한 줄만 — 가입 요청의 `consents`(보여 준 판 · 언어 그대로) */
export const consentRequestsOf = (
  rows: readonly ConsentRow[],
  checked: Readonly<Record<string, boolean>>,
): ConsentRequest[] =>
  rows
    .filter((r) => checked[r.type])
    .map((r) => ({ type: r.type, version: r.version, locale: r.locale }))

/** 필수 줄이 모두 체크됐다(필수가 없으면 늘 true) */
export const isSignUpComplete = (
  rows: readonly ConsentRow[],
  checked: Readonly<Record<string, boolean>>,
): boolean => rows.every((r) => r.kind !== 'required' || checked[r.type])

/**
 * 재동의 화면의 줄 — 서버가 말한 `missing`(그 판으로 동의하라)을 그대로 따른다. 제목은 목록에 있으면 그것, 없으면 종류 코드.
 * 모르는 종류(`UNKNOWN`, 판이 null)는 동의할 수 없으니 빼고, 남은 줄은 모두 필수다(서버가 필수만 막는다).
 */
export function rowsFromMissing(
  missing: readonly MissingConsent[],
  documents: readonly LegalDocumentSummary[],
  locale: string,
): ConsentRow[] {
  return missing.flatMap((m) => {
    if (!m.version) return []
    const known = documents.find((d) => d.type === m.type)
    return [
      {
        type: m.type,
        version: m.version,
        locale: known?.locale ?? locale,
        title: known?.title ?? m.type,
        kind: 'required' as const,
        template: known?.template ?? false,
        effectiveFrom: known?.version === m.version ? known.effectiveFrom : undefined,
      },
    ]
  })
}

/** 403 `LEGAL.RECONSENT_REQUIRED` 면 그 `data.missing`(없으면 빈 목록), 아니면 null */
export function missingFromError(error: unknown): MissingConsent[] | null {
  if (!(error instanceof ApiRequestError)) return null
  if (error.apiError.code !== ErrorCodes.LEGAL_RECONSENT_REQUIRED) return null
  const data = error.apiError.data
  const list =
    typeof data === 'object' && data !== null ? (data as { missing?: unknown }).missing : undefined
  return Array.isArray(list) ? (list as MissingConsent[]) : []
}

/** 서버가 막지 않는 경로(계약 4절: `/legal/**` · `/auth/**` · `/account/**`) — 클라이언트도 이 경로의 403 은 풀려 하지 않는다 */
export const DEFAULT_RECONSENT_EXCLUDED: readonly string[] = ['/legal', '/auth', '/account']

export function isReconsentExcluded(
  path: string,
  prefixes: readonly string[] = DEFAULT_RECONSENT_EXCLUDED,
): boolean {
  const clean = path.split('?')[0]
  return prefixes.some((p) => clean === p || clean.startsWith(`${p}/`))
}
