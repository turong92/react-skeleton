import { Alert } from '@skeleton/ui'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'

export type TestModeNoticeProps = { labels?: PaymentLabelsInput }

/** 「테스트 결제예요. 실제로 돈이 나가지 않아요」 — 결제 단추 가까이와 결과 화면에 `testMode` 면 늘 보인다(사라지지 않는 안내 띠) */
export function TestModeNotice({ labels: input }: TestModeNoticeProps) {
  const labels = resolvePaymentLabels(input)
  return (
    <Alert tone="info" toneLabel={labels.noticeLabel}>
      {labels.testMode}
    </Alert>
  )
}
