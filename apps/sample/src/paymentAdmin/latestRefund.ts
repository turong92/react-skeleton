/** 방금 나간 환불 줄 하나와 그것을 받은 때(`Date.now()`) - 직접 환불의 `done` · 승인의 `approved` */
export type SentRefund<Line> = { refund: Line | undefined; at?: number }

/**
 * 화면의 「방금 한 일」 상태 줄이 말할 하나 - 직접 환불과 승인이 둘 다 있으면 **더 최근 것**이다
 * (직접 환불 뒤에 승인했는데 예전 직접 환불의 금액을 말하면 안 된다).
 */
export function latestRefund<Line>(a: SentRefund<Line>, b: SentRefund<Line>): Line | undefined {
  if (a.refund === undefined) return b.refund
  if (b.refund === undefined) return a.refund
  return (b.at ?? 0) > (a.at ?? 0) ? b.refund : a.refund
}
