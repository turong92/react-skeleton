import { describe, expect, it } from 'vitest'
import type { ApiRequestInit } from '../../api/client'
import {
  createSkeletonWorkbenchClient,
  type SkeletonModuleResponse,
  type SkeletonNotificationPublishRequest,
  type SkeletonPaymentRouteRequest,
  type SkeletonStorageValidationRequest,
} from './skeletonWorkbenchClient'

type Call = {
  kind: 'list' | 'value'
  path: string
  init?: ApiRequestInit
}

describe('createSkeletonWorkbenchClient', () => {
  it('reads the backend module catalog through the list response contract', async () => {
    const calls: Call[] = []
    const client = createSkeletonWorkbenchClient({
      list: async <T>(path: string, init?: ApiRequestInit) => {
        calls.push({ kind: 'list', path, init })
        return [
          moduleOf({ id: 'platform', group: 'foundation', status: 'ACTIVE' }),
          moduleOf({ id: 'payment-toss', group: 'payment', status: 'DISABLED' }),
        ] as T[]
      },
      value: async () => {
        throw new Error('not used')
      },
    })

    const modules = await client.listModules({ traceId: 'trace-1' })

    expect(modules.map((module) => module.id)).toEqual(['platform', 'payment-toss'])
    expect(calls).toEqual([
      {
        kind: 'list',
        path: '/skeleton/modules',
        init: { traceId: 'trace-1' },
      },
    ])
  })

  it('wraps redis, storage, notification, and payment route smoke calls with stable paths and payloads', async () => {
    const calls: Call[] = []
    const client = createSkeletonWorkbenchClient({
      list: async () => {
        throw new Error('not used')
      },
      value: async <T>(path: string, init?: ApiRequestInit) => {
        calls.push({ kind: 'value', path, init })
        return { ok: true } as T
      },
    })
    const storageRequest: SkeletonStorageValidationRequest = {
      fileName: 'avatar.png',
      contentType: 'image/png',
      sizeBytes: 12,
    }
    const notificationRequest: SkeletonNotificationPublishRequest = {
      topic: 'runs',
      type: 'smoke',
      severity: 'INFO',
      title: 'Smoke',
      message: 'FE workbench smoke',
      payload: { source: 'fe' },
    }
    const paymentRouteRequest: SkeletonPaymentRouteRequest = {
      amount: 1000,
      currency: 'KRW',
      country: 'KR',
    }

    await client.redisKey('orders:1', { traceId: 'trace-1' })
    await client.validateStorage(storageRequest, { traceId: 'trace-1' })
    await client.publishNotification(notificationRequest, { traceId: 'trace-1' })
    await client.routePayment(paymentRouteRequest, { traceId: 'trace-1' })

    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/skeleton/redis/key',
        init: { traceId: 'trace-1', params: { value: 'orders:1' } },
      },
      {
        kind: 'value',
        path: '/skeleton/storage/validate',
        init: { traceId: 'trace-1', method: 'POST', json: storageRequest },
      },
      {
        kind: 'value',
        path: '/skeleton/notifications',
        init: { traceId: 'trace-1', method: 'POST', json: notificationRequest },
      },
      {
        kind: 'value',
        path: '/skeleton/payments/route',
        init: {
          traceId: 'trace-1',
          params: {
            amount: 1000,
            currency: 'KRW',
            country: 'KR',
          },
        },
      },
    ])
  })
})

function moduleOf(
  partial: Pick<SkeletonModuleResponse, 'id' | 'group' | 'status'>,
): SkeletonModuleResponse {
  return {
    ...partial,
    configPrefix: `skeleton.${partial.id}`,
    requiredInfrastructure: [],
    beans: [],
  }
}
