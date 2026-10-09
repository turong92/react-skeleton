import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { adminOrder } from '../test/fixtures'
import type { PaymentAdminApi } from './adminApi'
import { useDirectRefund } from './useDirectRefund'

/** 훅을 한 번 그려 돌려준 값(`dialog` 의 확인 함수 포함)을 꺼낸다 */
function mount(api: PaymentAdminApi, onSend: () => void) {
  let captured: ReturnType<typeof useDirectRefund> | undefined
  function Probe() {
    captured = useDirectRefund(api, { order: adminOrder(), onSend })
    return null
  }
  renderToStaticMarkup(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <Probe />
    </QueryClientProvider>,
  )
  return captured as ReturnType<typeof useDirectRefund>
}

const confirmOf = (dialog: ReactElement) =>
  (
    dialog.props as {
      onConfirm: (input: { reasonCode: string; amount: number }) => void
    }
  ).onConfirm

describe('useDirectRefund — onSend', () => {
  it('is called the moment the refund is SENT, before any answer - a refund whose outcome is lost leaves the "matched with the provider" note stale too', () => {
    const onSend = vi.fn()
    const api = {
      refundOrder: () => new Promise(() => undefined), // 답이 오지 않는다
    } as unknown as PaymentAdminApi
    const hook = mount(api, onSend)
    confirmOf(hook.dialog)({ reasonCode: 'OPERATOR', amount: 1000 })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('is called once per send, also when the send ends in an error', async () => {
    const onSend = vi.fn()
    const api = {
      refundOrder: () => Promise.reject(new Error('network')),
    } as unknown as PaymentAdminApi
    const hook = mount(api, onSend)
    confirmOf(hook.dialog)({ reasonCode: 'OPERATOR', amount: 1000 })
    await Promise.resolve()
    await Promise.resolve()
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
