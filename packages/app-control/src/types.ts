/** 백엔드 `GET /api/v1/app/config` 의 `value` (kotlin-skeleton `docs/app-control-http-contract.md`) */
export type AppConfigMaintenance = {
  enabled: boolean
  /** 점검 중일 때만 채워진다 */
  message: string | null
  /** 점검 끝 예정(ISO `...Z`) — 점검 중이고 운영자가 적었을 때만 */
  endsAt: string | null
}

/** 한 플랫폼(`android` · `ios` · `web` …)의 버전 정책 — null 인 칸은 그 규칙이 없다 */
export type PlatformPolicy = {
  /** 이보다 낮으면 강제 업데이트 */
  minVersion: string | null
  /** 이보다 낮으면 닫을 수 있는 안내 */
  recommendedVersion: string | null
  storeUrl: string | null
}

export type AppConfig = {
  serverTime: string
  maintenance: AppConfigMaintenance
  /** 운영자가 클라이언트에 보이기로 한 스위치만. 키가 없으면 꺼짐으로 취급한다 */
  flags: Record<string, boolean>
  platforms: Record<string, PlatformPolicy>
}

/** 화면이 보여 줄 것 하나 — 점검 > 강제 업데이트 > 권장 업데이트 > 보통 순 */
export type AppState =
  | { kind: 'ok' }
  | { kind: 'maintenance'; message: string | null; endsAt: string | null }
  | { kind: 'update-required'; minVersion: string; storeUrl: string | null }
  | { kind: 'update-recommended'; recommendedVersion: string; storeUrl: string | null }
