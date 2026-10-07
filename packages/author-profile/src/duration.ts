/** 기다려야 하는 시간 — 문구는 앱이 단위마다 번역한다(`labels.rateLimited`) */
export type Duration = { unit: 'second' | 'minute' | 'hour' | 'day'; value: number }

/**
 * 초를 사람이 읽기 좋은 가장 큰 단위로 접는다 — 60초 미만은 초, 1시간 미만은 분, 1일 미만은 시간, 그 위는 일. **올림**한다(더 짧게 약속하지 않는다).
 * 분이 60 이 되거나 시간이 24 가 되면 한 단위 위로 올려 「60분」 「24시간」은 나오지 않는다. 0 · 음수 · 숫자가 아닌 값은 1초.
 */
export function foldDuration(seconds: number): Duration {
  const s = Number.isFinite(seconds) && seconds > 0 ? seconds : 1
  if (s < 60) return { unit: 'second', value: Math.ceil(s) }
  const minutes = Math.ceil(s / 60)
  if (minutes < 60) return { unit: 'minute', value: minutes }
  const hours = Math.ceil(s / 3600)
  if (hours < 24) return { unit: 'hour', value: hours }
  return { unit: 'day', value: Math.ceil(s / 86_400) }
}
