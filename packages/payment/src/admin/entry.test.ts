import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as admin from './index'
import * as main from '../index'

describe('@skeleton/payment/admin is its own entry (like @skeleton/auth/admin)', () => {
  it('package.json exports ./admin next to the root, both pointing at src', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { exports: Record<string, { types: string; default: string }> }
    expect(manifest.exports['./admin']).toEqual({
      types: './src/admin/index.ts',
      default: './src/admin/index.ts',
    })
    expect(manifest.exports['.']?.default).toBe('./src/index.ts')
  })

  it('exports the api, the hooks (with the request decision window wired to them) and the five parts', () => {
    for (const name of [
      'createPaymentAdminApi',
      'adminAccessProblem',
      'useAdminOrders',
      'useAdminOrder',
      'useAdminRefundRequests',
      'useAdminWebhookEvents',
      'useOperatorRefund',
      'useApproveRefund',
      'useRejectRefund',
      'useSyncOrder',
      'useRetryWebhookEvent',
      'useRefundDecision',
      'useDirectRefund',
      'heldSecondsOf',
      'refundProblemOf',
      'RefundNotDoneError',
      'AdminOrderTable',
      'AdminOrderPanel',
      'AdminRefundDialog',
      'RefundRequestTable',
      'WebhookEventTable',
    ])
      expect(admin, name).toHaveProperty(name)
  })

  it('the main entry does not carry the operator parts (a project that does not use them does not ship them)', () => {
    for (const name of Object.keys(admin)) {
      expect(main, name).not.toHaveProperty(name)
    }
  })
})
