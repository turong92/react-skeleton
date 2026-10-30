const PRESETS = [30, 90, 365] as const
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

/**
 * 만료 고르기 칸 - 일 수, `null` 은 「만료 없음」. 앱이 키 수명 상한(`max-lifetime`)을 두면 그보다 긴 칸과 「없음」은 서버가 거절하므로 숨긴다
 * (상한이 칸 사이에 있으면 상한 자신을 칸으로 더한다)
 */
export function expiryChoices(maxLifetimeDays?: number): (number | null)[] {
  if (maxLifetimeDays === undefined) return [...PRESETS, null]
  const fits: number[] = PRESETS.filter((days) => days <= maxLifetimeDays)
  return fits.includes(maxLifetimeDays) ? fits : [...fits, maxLifetimeDays]
}

/** 지금부터 `days` 일 뒤의 ISO 시각. 「없음」(`null`)이면 필드를 보내지 않는다 */
export function expiresAtFor(
  days: number | null,
  nowMs: number,
  maxLifetimeDays?: number,
): string | undefined {
  if (days === null) return undefined
  // 상한과 같은 칸은 한 분 모자라게 - 브라우저 시계가 서버보다 조금 빨라도 서버의 상한 검사(`serverNow + max`)를 넘지 않는다
  const span = Math.min(
    days * DAY_MS,
    maxLifetimeDays === undefined ? Infinity : maxLifetimeDays * DAY_MS - MINUTE_MS,
  )
  return new Date(nowMs + span).toISOString()
}
