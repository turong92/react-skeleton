import type { AppControlApi } from './appControlApi'

/** 쿼리 키 */
export const appControlKeys = {
  all: ['app-control'] as const,
  config: () => [...appControlKeys.all, 'config'] as const,
}

export const appConfigQuery = (api: AppControlApi) => ({
  queryKey: appControlKeys.config(),
  queryFn: () => api.config(),
})
