import {
  createSkeletonHttpClient,
  type SkeletonHttpClient,
  type SkeletonHttpRequest,
} from '../modules/http/skeletonHttpClient'
import type {
  ApiBasicResponse,
  ApiCursorResponse,
  ApiHttpResponse,
  ApiListResponse,
  ApiPageResponse,
  ApiValueResponse,
} from './types'

import { createServerClock, userTimeZone } from '../lib/time'

const DEFAULT_BASE_URL = '/api/v1'

/** 서버 시각 보정 (응답 Date 헤더). 카운트다운·마감 판정은 `serverClock.now()` 로 */
export const serverClock = createServerClock()

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
export type ApiRequestInit = SkeletonHttpRequest

let apiHttpClient: SkeletonHttpClient = createDefaultApiHttpClient()

export function apiEndpoint(path: string): string {
  return apiHttpClient.endpoint(path)
}

export async function api<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiValue<T>(path, init)
}

export async function apiBasic(path: string, init?: ApiRequestInit): Promise<ApiBasicResponse> {
  return apiHttpClient.basic(path, init)
}

export async function apiValue<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiHttpClient.value<T>(path, init)
}

export async function apiList<T>(path: string, init?: ApiRequestInit): Promise<T[]> {
  return apiHttpClient.list<T>(path, init)
}

export async function apiPage<T>(path: string, init?: ApiRequestInit): Promise<ApiPageResponse<T>> {
  return apiHttpClient.page<T>(path, init)
}

export async function apiCursor<T>(
  path: string,
  init?: ApiRequestInit,
): Promise<ApiCursorResponse<T>> {
  return apiHttpClient.cursor<T>(path, init)
}

export async function apiEnvelope<TEnvelope>(
  path: string,
  init?: ApiRequestInit,
): Promise<TEnvelope> {
  return apiHttpClient.envelope<TEnvelope>(path, init)
}

export async function apiResponse<TEnvelope = unknown>(
  path: string,
  init?: ApiRequestInit,
): Promise<ApiHttpResponse<TEnvelope>> {
  return apiHttpClient.response<TEnvelope>(path, init)
}

export function setApiHttpClientForTesting(nextClient: SkeletonHttpClient): () => void {
  const previous = apiHttpClient
  apiHttpClient = nextClient
  return () => {
    apiHttpClient = previous
  }
}

export type {
  ApiBasicResponse,
  ApiCursorResponse,
  ApiHttpResponse,
  ApiListResponse,
  ApiPageResponse,
  ApiValueResponse,
}

function createDefaultApiHttpClient(): SkeletonHttpClient {
  return createSkeletonHttpClient({
    baseURL: API_BASE_URL,
    timeoutMs: numberFromEnv(import.meta.env.VITE_API_TIMEOUT_MS) ?? 15_000,
    retry: {
      attempts: numberFromEnv(import.meta.env.VITE_API_RETRY_ATTEMPTS) ?? 0,
      delayMs: numberFromEnv(import.meta.env.VITE_API_RETRY_DELAY_MS) ?? 150,
    },
    // 기기 시간대를 보내 백엔드 modules:time 이 같은 시간대로 문구를 만들게
    requestInterceptors: [
      (config) => ({
        ...config,
        headers: { ...(config.headers ?? {}), 'X-Time-Zone': userTimeZone() },
      }),
    ],
    // 응답 Date 헤더로 서버 시각 보정
    responseInterceptors: [
      (response) => {
        serverClock.observeDateHeader(response.headers?.date as string | undefined)
        return response
      },
    ],
  })
}

function normalizeBaseUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function numberFromEnv(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
