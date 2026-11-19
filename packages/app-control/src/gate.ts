import type { AppConfig, AppState } from './types'
import { isBelow } from './version'

export type AppStateOptions = {
  /** 이 앱의 버전(보통 빌드 때 넣는 상수). 없으면 버전으로 막지 않는다 */
  appVersion?: string
  /** `platforms` 의 키(기본 `web`) */
  platform?: string
  /** 사용자가 닫은 권장 버전 — 같은 권장 버전은 다시 묻지 않는다 */
  dismissed?: string | null
}

/**
 * 서버가 준 설정으로 지금 화면에 올릴 것 하나를 정한다. 설정을 아직 못 읽었거나(`undefined`) 그 플랫폼의 규칙이 없으면 `ok` —
 * 서버가 「그렇다」고 말했을 때만 막는다.
 */
export function appStateOf(config: AppConfig | undefined, options: AppStateOptions): AppState {
  if (!config) return { kind: 'ok' }
  const { maintenance } = config
  if (maintenance.enabled) {
    return { kind: 'maintenance', message: maintenance.message, endsAt: maintenance.endsAt }
  }
  const { appVersion, platform = 'web', dismissed = null } = options
  const policy = config.platforms[platform]
  if (!policy || !appVersion) return { kind: 'ok' }
  if (policy.minVersion && isBelow(appVersion, policy.minVersion)) {
    return { kind: 'update-required', minVersion: policy.minVersion, storeUrl: policy.storeUrl }
  }
  if (
    policy.recommendedVersion &&
    policy.recommendedVersion !== dismissed &&
    isBelow(appVersion, policy.recommendedVersion)
  ) {
    return {
      kind: 'update-recommended',
      recommendedVersion: policy.recommendedVersion,
      storeUrl: policy.storeUrl,
    }
  }
  return { kind: 'ok' }
}
