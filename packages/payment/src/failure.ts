import { errorReferenceOf } from '@skeleton/ui'
import { declineDetail } from './errors'
import type { DeclineCategory } from './labels'

const CATEGORIES: readonly DeclineCategory[] = [
  'LIMIT_OR_BALANCE',
  'CARD_DECLINED',
  'TEMPORARY',
  'OTHER',
]

/** 거절(`DECLINED`)의 `data.category` → 문구 종류. 거절이 아니거나 모르는 값이면 `OTHER` */
export function declineCategoryOf(error: unknown): DeclineCategory {
  const category = declineDetail(error)?.category
  return CATEGORIES.find((known) => known === category) ?? 'OTHER'
}

/**
 * 문의할 때 불러 주는 참조 번호 — 요청의 traceId 와 결제사 코드를 한 줄로(`ErrorReference` 안에서만 보인다).
 * 오류에서 얻을 수 없으면 `fallback`(예: 주문의 `failureCode`).
 */
export function referenceOf(error: unknown, fallback?: string | null): string | undefined {
  const parts = [errorReferenceOf(error), declineDetail(error)?.providerCode]
  const joined = parts.filter(Boolean).join(' / ')
  return joined || fallback || undefined
}
