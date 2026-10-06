import type { ApiClient, ApiPageResponse } from '@skeleton/api-client'
import type {
  ConsentEvent,
  ConsentRequest,
  ConsentSource,
  LegalDocument,
  LegalDocumentSummary,
  MyConsents,
  ReadDocumentOptions,
} from './types'

type LegalClient = Pick<ApiClient, 'value' | 'list' | 'page'>

export type LegalApi = {
  /** `GET {basePath}/documents` — 공개(로그인 없이도 되고, 있으면 토큰이 함께 간다). (종류, 언어)마다 **현재** 판 하나 */
  documents(): Promise<LegalDocumentSummary[]>
  /** `GET {basePath}/documents/{type}?version=&locale=` — 공개. 판을 안 주면 현재 판, 주면 이미 효력이 시작된 어느 판이든. 404 `LEGAL.DOCUMENT_NOT_FOUND` */
  document(type: string, options?: ReadDocumentOptions): Promise<LegalDocument>
  /** `GET {basePath}/consents/me` — 로그인한 사람의 동의 상태(`blocked` · `missing`) */
  myConsents(): Promise<MyConsents>
  /** `POST {basePath}/consents` — 1~20개, 현재 판(또는 유예 중인 직전 판)만. 409 `LEGAL.VERSION_STALE`(`data.stale[]`) · 400 `LEGAL.UNKNOWN_DOCUMENT`. 돌려주는 값은 `myConsents()` 와 같다 */
  agree(consents: ConsentRequest[], source?: ConsentSource): Promise<MyConsents>
  /** `POST {basePath}/consents/{type}/withdraw` — **선택** 동의만. 필수는 409 `LEGAL.WITHDRAWAL_NOT_ALLOWED` */
  withdraw(type: string): Promise<MyConsents>
  /** `GET {basePath}/consents/me/history?page=&size=` — 내 동의 · 철회 기록(최신순, IP 없음) */
  history(params?: { page?: number; size?: number }): Promise<ApiPageResponse<ConsentEvent>>
}

export type LegalApiOptions = {
  /** 백엔드 `skeleton.legal.http.base-path` 의 `/api/v1` 뒤 부분(기본 `/legal`) */
  basePath?: string
}

const seg = encodeURIComponent

/** 백엔드 `modules/legal` 계약을 그대로 부르는 얇은 호출 모음. 저장 · 캐시는 하지 않는다(화면이 TanStack Query 로) */
export function createLegalApi(
  client: LegalClient,
  { basePath = '/legal' }: LegalApiOptions = {},
): LegalApi {
  return {
    // 공개 경로지만 `skipAuth` 를 쓰지 않는다 — 로그인한 사람의 토큰은 그대로 간다. 모듈이 없는 백엔드는 모르는 경로를 401(익명) · 404(로그인) 로 답하는데,
    // `skipAuth` 호출의 401 도 앱의 401 처리기(세션 끝남으로 보고 토큰을 비운다)를 지나므로 로그인한 사람이 약관 화면에서 로그아웃될 수 있다(e2e 로 확인)
    documents: () => client.list(`${basePath}/documents`),
    document: (type, options = {}) =>
      client.value(`${basePath}/documents/${seg(type)}`, {
        params: {
          ...(options.version ? { version: options.version } : {}),
          ...(options.locale ? { locale: options.locale } : {}),
        },
      }),
    myConsents: () => client.value(`${basePath}/consents/me`),
    agree: (consents, source) =>
      client.value(`${basePath}/consents`, {
        method: 'POST',
        json: { consents, ...(source ? { source } : {}) },
      }),
    withdraw: (type) =>
      client.value(`${basePath}/consents/${seg(type)}/withdraw`, { method: 'POST' }),
    history: (params = {}) => client.page(`${basePath}/consents/me/history`, { params }),
  }
}
