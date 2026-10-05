import type { ApiClient } from '@skeleton/api-client'
import { createPaymentApi, type PaymentRoute } from '@skeleton/payment'
import { Button, Field, Input } from '@skeleton/ui'
import { useMemo, useState } from 'react'
import styles from './Demo.module.css'

/** `@skeleton/payment` — 결제 모듈이 여는 HTTP 가 없어, 워크벤치 데모의 라우팅 확인(`GET /skeleton/payments/route`)만 부른다 */
export function PaymentDemo({ client }: { client: ApiClient }) {
  const api = useMemo(
    () => createPaymentApi(client, { paths: { route: '/skeleton/payments/route' } }),
    [client],
  )
  const [amount, setAmount] = useState('15000')
  const [currency, setCurrency] = useState('KRW')
  const [country, setCountry] = useState('KR')
  const [route, setRoute] = useState<PaymentRoute | null>(null)

  return (
    <div className={styles.stack}>
      <p className={styles.note}>
        금액 · 통화 · 국가로 어느 제공자(토스 · 스트라이프)가 고를지 묻는다. confirm · cancel ·
        refund 는 앱이 컨트롤러를 열어야 해서 경로를 알려 줄 때만 생긴다.
      </p>
      <div className={styles.row}>
        <Field label="금액">
          {(c) => <Input {...c} value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="통화">
          {(c) => <Input {...c} value={currency} onChange={(e) => setCurrency(e.target.value)} />}
        </Field>
        <Field label="국가">
          {(c) => <Input {...c} value={country} onChange={(e) => setCountry(e.target.value)} />}
        </Field>
        <Button
          onClick={async () =>
            setRoute(await api.route!({ amount: Number(amount) || undefined, currency, country }))
          }
        >
          라우팅 확인
        </Button>
      </div>
      {route && <pre>{JSON.stringify(route, null, 2)}</pre>}
    </div>
  )
}
