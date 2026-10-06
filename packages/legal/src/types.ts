/*
 * 법적 문서 · 동의 DTO — kotlin-skeleton `docs/legal-http-contract.md`(DRAFT-2 → e073a1e 에 커밋된 본) 를 그대로 옮긴 것.
 * 문서 종류(type)는 소문자 코드이고 앱이 정한다(`terms` · `privacy` · `marketing` …) — 목록을 코드에 박지 말고 `GET /documents` 에서 읽는다.
 * 판(version)은 불투명한 문자열 — 같은지만 비교하고 순서를 매기지 않는다(어느 판이 현재인지는 서버가 정한다).
 */

export type LegalDocumentSummary = {
  type: string
  locale: string
  version: string
  effectiveFrom: string
  title: string
  sha256: string
  /** 현재 동의 없이 서비스를 쓸 수 없다(재동의 대상) */
  required: boolean
  /** 가입 요청이 이 동의 없이는 거절된다 */
  requiredAtSignUp: boolean
  /** 모듈의 예시 문장 — 「샘플 문서」 표시를 붙여도 된다 */
  template: boolean
  /** 나중에 효력이 시작되는 판(공지용) — 효력 전에는 동의할 수 없다 */
  next: { version: string; effectiveFrom: string } | null
}

export type LegalDocument = {
  type: string
  version: string
  /** 실제로 담긴 언어 — 요청한 언어가 이 판에 없으면 앱 기본 언어 */
  locale: string
  requestedLocale?: string
  effectiveFrom: string
  /** 지금 효력 있는 판인가(옛 판을 읽는 중이면 false) */
  current: boolean
  template: boolean
  title: string
  sha256: string
  required: boolean
  requiredAtSignUp: boolean
  /** 안전한 부분집합 — 날 HTML 없이 `MarkdownView` 로 그린다 */
  markdown: string
}

export type ConsentState = 'CURRENT' | 'GRACE' | 'OUTDATED' | 'MISSING' | 'WITHDRAWN'

export type MissingReason = 'NOT_AGREED' | 'STALE' | 'UNKNOWN'

/** 동의해야 하는 것 — `version` 이 그 판으로 동의하라는 뜻(`POST /consents` 에 그대로 넣는다). UNKNOWN 이면 version 이 null */
export type MissingConsent = { type: string; version: string | null; reason: MissingReason }

export type MyConsentItem = {
  type: string
  required: boolean
  requiredAtSignUp: boolean
  state: ConsentState
  current: { version: string; effectiveFrom: string; locales: string[] } | null
  agreed: { version: string; agreedAt: string; source: string } | null
  /** `GRACE` 일 때 유예가 끝나는 때 — 그때까지는 막히지 않는다 */
  graceUntil: string | null
}

export type MyConsents = {
  /** 필수 문서 중 하나라도 MISSING · OUTDATED */
  blocked: boolean
  items: MyConsentItem[]
  /** 지금 동의해야 하는 것 — `POST /consents` 에 그대로 넣는 목록 */
  missing: MissingConsent[]
}

/** 「이 판을 이 언어로 읽고 동의한다」 — `locale` 은 사용자가 실제로 읽은 언어 */
export type ConsentRequest = { type: string; version: string; locale?: string }

/** `POST /consents` 의 `source`(`^[a-z][a-z0-9-]{1,31}$`, `sign-up` 은 서버 전용) */
export type ConsentSource = 'consent' | 're-consent' | 'first-sign-in' | 'settings' | (string & {})

export type ConsentEvent = {
  type: string
  version: string
  action: 'AGREED' | 'WITHDRAWN'
  locale: string
  source: string
  at: string
}

export type ReadDocumentOptions = { version?: string; locale?: string }
