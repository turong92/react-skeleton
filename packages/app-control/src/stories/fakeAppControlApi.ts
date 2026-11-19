import type { AppControlApi } from '../appControlApi'
import type { AppConfig } from '../types'

/** 스토리용 가짜 서버 — 필요한 칸만 덮어쓴다 */
export function createFakeAppControlApi(over: Partial<AppConfig> = {}): AppControlApi {
  const config: AppConfig = {
    serverTime: '2026-11-16T09:00:00Z',
    maintenance: { enabled: false, message: null, endsAt: null },
    flags: {},
    platforms: {},
    ...over,
  }
  return { config: async () => config }
}
