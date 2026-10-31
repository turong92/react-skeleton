import type { PushApi } from './pushApi'

/** 키는 `push` 한 뿌리 아래 */
export const pushKeys = {
  all: ['push'] as const,
  config: () => [...pushKeys.all, 'config'] as const,
  devices: () => [...pushKeys.all, 'devices'] as const,
  preferences: () => [...pushKeys.all, 'preferences'] as const,
  setPreference: () => [...pushKeys.all, 'set-preference'] as const,
  advertising: () => [...pushKeys.all, 'advertising'] as const,
}

/** 쿼리 정의(키 + 함수)를 훅과 따로 둔다 — 가짜 api 로 테스트하고 서버 렌더의 `prefetch` 에도 쓴다 */
export const configQuery = (api: Pick<PushApi, 'config'>) => ({
  queryKey: pushKeys.config(),
  queryFn: () => api.config(),
  // 공개 키는 서버를 바꿀 때만 달라진다 — 창이 다시 보일 때마다 묻지 않는다
  staleTime: 5 * 60_000,
})

export const devicesQuery = (api: Pick<PushApi, 'devices'>) => ({
  queryKey: pushKeys.devices(),
  queryFn: async () => (await api.devices()).items,
})

export const preferencesQuery = (api: Pick<PushApi, 'preferences'>) => ({
  queryKey: pushKeys.preferences(),
  queryFn: async () => (await api.preferences()).items,
})

export const advertisingQuery = (api: Pick<PushApi, 'getAdvertising'>) => ({
  queryKey: pushKeys.advertising(),
  queryFn: () => api.getAdvertising(),
})
