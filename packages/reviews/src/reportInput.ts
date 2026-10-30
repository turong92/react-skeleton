import type { ReportInput, ReportReason } from './types'

/** 보낼 신고 — 사유가 없으면 `null`. 자세한 내용은 앞뒤를 다듬고, 비면 보내지 않는다 */
export function buildReportInput(reason: ReportReason | null, detail: string): ReportInput | null {
  if (reason === null) return null
  const trimmed = detail.trim()
  return trimmed === '' ? { reason } : { reason, detail: trimmed }
}
