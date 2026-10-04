import { apiList, apiValue, type ApiRequestInit } from '../../api/client'

export type SkeletonModuleStatus = 'ACTIVE' | 'DISABLED' | 'MISSING'

export type SkeletonModuleResponse = {
  id: string
  group: string
  status: SkeletonModuleStatus
  configPrefix: string
  requiredInfrastructure: string[]
  beans: string[]
  note?: string | null
}

export type SkeletonRedisKeyResponse = {
  value: string
  key: string
}

export type SkeletonStorageValidationRequest = {
  fileName: string
  contentType?: string | null
  sizeBytes: number
}

export type SkeletonStorageValidationResponse = {
  valid: boolean
  errors: SkeletonStorageValidationErrorResponse[]
}

export type SkeletonStorageValidationErrorResponse = {
  code: string
  message: string
}

export type SkeletonNotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

export type SkeletonNotificationPublishRequest = {
  topic: string
  type: string
  recipientIds?: string[]
  severity: SkeletonNotificationSeverity
  title?: string | null
  message?: string | null
  payload?: Record<string, unknown>
}

export type SkeletonNotificationPublishResponse = {
  eventId: string
  topic: string
  type: string
  recipientIds: string[]
  deliveredSubscribers: number
}

export type SkeletonPaymentRouteRequest = {
  provider?: string | null
  amount?: number | null
  currency?: string | null
  country?: string | null
}

export type SkeletonPaymentRouteResponse = {
  provider: string
  requestedProvider?: string | null
  amount?: number | null
  currency?: string | null
  country?: string | null
}

export type SkeletonWorkbenchTransport = {
  list<T>(path: string, init?: ApiRequestInit): Promise<T[]>
  value<T>(path: string, init?: ApiRequestInit): Promise<T>
}

export type SkeletonWorkbenchClient = {
  listModules(init?: ApiRequestInit): Promise<SkeletonModuleResponse[]>
  redisKey(value: string, init?: ApiRequestInit): Promise<SkeletonRedisKeyResponse>
  validateStorage(
    request: SkeletonStorageValidationRequest,
    init?: ApiRequestInit,
  ): Promise<SkeletonStorageValidationResponse>
  publishNotification(
    request: SkeletonNotificationPublishRequest,
    init?: ApiRequestInit,
  ): Promise<SkeletonNotificationPublishResponse>
  routePayment(
    request: SkeletonPaymentRouteRequest,
    init?: ApiRequestInit,
  ): Promise<SkeletonPaymentRouteResponse>
}

export const skeletonWorkbenchClient = createSkeletonWorkbenchClient({
  list: apiList,
  value: apiValue,
})

export function createSkeletonWorkbenchClient(
  transport: SkeletonWorkbenchTransport,
): SkeletonWorkbenchClient {
  return {
    listModules: (init) => transport.list<SkeletonModuleResponse>('/skeleton/modules', init),
    redisKey: (value, init) =>
      transport.value<SkeletonRedisKeyResponse>('/skeleton/redis/key', {
        ...init,
        params: { ...init?.params, value },
      }),
    validateStorage: (request, init) =>
      transport.value<SkeletonStorageValidationResponse>('/skeleton/storage/validate', {
        ...init,
        method: 'POST',
        json: request,
      }),
    publishNotification: (request, init) =>
      transport.value<SkeletonNotificationPublishResponse>('/skeleton/notifications', {
        ...init,
        method: 'POST',
        json: request,
      }),
    routePayment: (request, init) =>
      transport.value<SkeletonPaymentRouteResponse>('/skeleton/payments/route', {
        ...init,
        params: { ...init?.params, ...compactParams(request) },
      }),
  }
}

function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  )
}
