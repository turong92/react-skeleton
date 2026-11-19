import type { ApiClient } from '@skeleton/api-client'
import type { AppConfig } from './types'

type AppControlClient = Pick<ApiClient, 'value'>

export type AppControlApi = {
  /** `GET {basePath}` — 익명이고 점검 중에도 열려 있다. 점검 · 클라이언트에 보이는 스위치 · 플랫폼별 버전 정책 */
  config(): Promise<AppConfig>
}

export type AppControlApiOptions = {
  /** 백엔드 `skeleton.app-control.config.base-path` 의 `/api/v1` 뒤 부분(기본 `/app/config`) */
  basePath?: string
}

/** 백엔드 `modules/app-control` 계약을 그대로 부르는 얇은 호출. 저장 · 캐시는 하지 않는다(화면이 TanStack Query 로) */
export function createAppControlApi(
  client: AppControlClient,
  { basePath = '/app/config' }: AppControlApiOptions = {},
): AppControlApi {
  return { config: () => client.value<AppConfig>(basePath) }
}
