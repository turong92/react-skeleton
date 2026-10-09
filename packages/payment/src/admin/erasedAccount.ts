import type { AdminOrder } from './types'

/**
 * 계정이 지워진 결제의 계정 칸. 백엔드가 `skeleton.payment.erasure.account-id=TOMBSTONE` 이면 지워진 계정의 id 를 `deleted:<16자 16진수>` 로 바꾼다.
 * 기본 `KEEP` 이면 원래 id 가 그대로라 이 모양으로는 알 수 없다 - 그래서 운영자 응답의 `accountErasedAt`(계약 §5)을 먼저 본다.
 */
export const ERASED_ACCOUNT_PREFIX = 'deleted:'

export const isErasedAccountId = (accountId: string | null | undefined): boolean =>
  accountId != null && accountId.startsWith(ERASED_ACCOUNT_PREFIX)

/** 이 결제의 계정이 탈퇴했나 - 응답의 `accountErasedAt` 이 있으면 그것, 아니면(또는 함께) `TOMBSTONE` 모드의 대체 id */
export const isErasedAccount = (
  order: Pick<AdminOrder, 'accountId' | 'accountErasedAt'>,
): boolean => order.accountErasedAt != null || isErasedAccountId(order.accountId)
