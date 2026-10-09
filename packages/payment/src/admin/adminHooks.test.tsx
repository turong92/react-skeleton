import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PaymentAdminApi } from './adminApi'
import {
  useAdminOrder,
  useAdminOrders,
  useAdminRefundRequests,
  useAdminWebhookEvents,
  useApproveRefund,
  useOperatorRefund,
  useRejectRefund,
  useRetryWebhookEvent,
  useSyncOrder,
} from './adminHooks'
import { adminKeys } from './adminQueries'

const api = {} as PaymentAdminApi

function render(client: QueryClient, ui: () => string) {
  let out = ''
  function Probe() {
    out = ui()
    return null
  }
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  )
  return out
}

const page = (nextCursor: string | null, hasNext: boolean) => ({
  values: [],
  cursor: { nextCursor, hasNext },
  meta: { timestamp: 't' },
})

describe('operator hooks are thin wrappers over the query definitions', () => {
  it('useAdminOrder reads what is cached under the shared key and does not fetch without an id', () => {
    const client = new QueryClient()
    client.setQueryData(adminKeys.order('ord_1'), { order: { id: 'ord_1' }, refunds: [] })
    expect(
      render(
        client,
        () => (useAdminOrder(api, 'ord_1').data as { order: { id: string } }).order.id,
      ),
    ).toBe('ord_1')
    expect(render(client, () => useAdminOrder(api, undefined).fetchStatus)).toBe('idle')
  })

  it('the three lists are infinite queries that continue from the cursor', () => {
    const client = new QueryClient()
    client.setQueryData(adminKeys.orders({ review: true }), {
      pages: [page('c2', true)],
      pageParams: [undefined],
    })
    client.setQueryData(adminKeys.refunds({ status: 'REQUESTED' }), {
      pages: [page(null, false)],
      pageParams: [undefined],
    })
    client.setQueryData(adminKeys.webhookEvents({ status: 'DEAD' }), {
      pages: [page('c9', true)],
      pageParams: [undefined],
    })
    expect(render(client, () => String(useAdminOrders(api, { review: true }).hasNextPage))).toBe(
      'true',
    )
    expect(render(client, () => String(useAdminRefundRequests(api).hasNextPage))).toBe('false')
    expect(
      render(client, () => String(useAdminWebhookEvents(api, { status: 'DEAD' }).hasNextPage)),
    ).toBe('true')
  })

  it('every mutation hook starts idle', () => {
    const client = new QueryClient()
    for (const use of [
      useOperatorRefund,
      useApproveRefund,
      useRejectRefund,
      useSyncOrder,
      useRetryWebhookEvent,
    ])
      expect(render(client, () => use(api).status)).toBe('idle')
  })
})
