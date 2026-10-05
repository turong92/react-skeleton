import {
  createPaymentApi,
  confirmRequestFromTossRedirect,
  type PaymentOperationResult,
} from '@skeleton/payment'
import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { Case } from '../components/Section'

const REDIRECT = '?paymentKey=tgen_demo&orderId=order-1&amount=15000'
const request = confirmRequestFromTossRedirect(REDIRECT, { currency: 'KRW' })

const result: PaymentOperationResult = {
  provider: 'toss',
  providerPaymentId: request.providerPaymentId,
  status: 'CONFIRMED',
  amount: request.amount,
  trace: { provider: 'toss' },
  attributes: {},
}

/** 결제는 일부러 얇다 — 계약 타입 · 리다이렉트 변환 · 준 경로만 부르는 호출. 가짜 클라이언트가 호출을 기록한다 */
export function PaymentDemo() {
  const [calls, setCalls] = useState<string[]>([])
  const [outcome, setOutcome] = useState<PaymentOperationResult>()
  const api = createPaymentApi(
    {
      value: async <T,>(path: string) => {
        setCalls((list) => [...list, `POST ${path}`])
        return result as T
      },
    },
    { paths: { confirm: '/payments/confirm' } },
  )
  return (
    <>
      <Case label={`confirmRequestFromTossRedirect('${REDIRECT}')`}>
        <pre>
          <code>{JSON.stringify(request, null, 2)}</code>
        </pre>
      </Case>
      <Case label="api.confirm(request) over a fake client">
        <Button variant="secondary" onClick={() => void api.confirm?.(request).then(setOutcome)}>
          결제 승인 호출
        </Button>
        <span>
          호출: {calls.length ? calls.join(', ') : '(아직 없음)'} · 상태: {outcome?.status ?? '-'}
        </span>
      </Case>
      <p>
        금액은 주소에서 왔다 — 서버가 주문의 실제 금액과 대조해야 한다. 이 패키지가 대신하지 않는다.
      </p>
    </>
  )
}
