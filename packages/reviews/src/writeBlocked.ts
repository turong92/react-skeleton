import type { ReviewsLabels } from './labels'
import type { WriteBlockedReason } from './types'

/** 서버가 `summary.writeBlockedReason` 으로 준 코드 → 폼 자리에 보일 문장. 막힌 게 없으면 `null` */
export function writeBlockedMessage(
  reason: WriteBlockedReason | null,
  labels: Pick<ReviewsLabels, 'writeBlocked'>,
): string | null {
  return reason === null ? null : labels.writeBlocked[reason]
}
