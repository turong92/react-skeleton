import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { useCreateOrder, type PaymentLedgerApi } from '@skeleton/payment'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../app/createQueryClient'

const answered = (status: number, code: string) =>
  new ApiRequestError(
    { code, title: 'Too many requests', status, timestamp: 't' },
    'tr',
    'sp',
    'tp',
  )

/** 앱이 쓰는 그대로 만든 클라이언트에 주문 만들기 훅을 한 번 그려 변경 함수를 꺼낸다 */
function mountCreateOrder(
  error: Error,
  options: Parameters<typeof useCreateOrder>[1],
  onError: (error: unknown) => void,
) {
  const client = createQueryClient({ onError })
  const api = {
    createOrder: () => Promise.reject(error),
  } as unknown as PaymentLedgerApi
  let hook: ReturnType<typeof useCreateOrder> | undefined
  function Probe() {
    hook = useCreateOrder(api, options)
    return null
  }
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  )
  return hook as ReturnType<typeof useCreateOrder>
}

const cheer = { itemType: 'cheer', itemRef: 'cheer-3000' }

describe('a refused order creation (429) is told by the cheer screen in place - never by a global toast too', () => {
  it('the order-creation call the cheer screen makes is quiet for 429 (the server English title stays out of a Korean screen)', async () => {
    const onError = vi.fn()
    const hook = mountCreateOrder(
      answered(429, ErrorCodes.COMMON_TOO_MANY_REQUESTS),
      { meta: { quietStatuses: [429] } },
      onError,
    )
    await expect(hook.mutateAsync(cheer)).rejects.toBeInstanceOf(ApiRequestError)
    expect(onError).not.toHaveBeenCalled()
  })

  it('the same call still toasts the failures the screen does not speak for (a 500)', async () => {
    const onError = vi.fn()
    const hook = mountCreateOrder(
      answered(500, ErrorCodes.COMMON_INTERNAL_SERVER_ERROR),
      { meta: { quietStatuses: [429] } },
      onError,
    )
    await expect(hook.mutateAsync(cheer)).rejects.toBeInstanceOf(ApiRequestError)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('without the mark a 429 is toasted as before - other screens have nothing else to tell it (the 429 is not filtered app-wide)', async () => {
    const onError = vi.fn()
    const hook = mountCreateOrder(
      answered(429, ErrorCodes.COMMON_TOO_MANY_REQUESTS),
      undefined,
      onError,
    )
    await expect(hook.mutateAsync(cheer)).rejects.toBeInstanceOf(ApiRequestError)
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
