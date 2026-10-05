import type { FormatOptions, ZonedMoment } from './types'

/** 브라우저(기기)의 IANA 시간대. api-client 헤더 `X-Time-Zone` 에 이걸 보낸다 */
export function userTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function userLocale(): string {
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'ko-KR'
}

/**
 * 일어난 시점(ISO `...Z`)을 보는 사람 시간대·로케일로. 시간대 이름은 `GMT+9` 식(약어는 모호).
 * 예: `formatInstant('2026-10-05T12:00:00Z', { zone: 'Asia/Seoul', locale: 'ko-KR' })`
 *   → `2026. 10. 5. 오후 9:00 GMT+9`
 */
export function formatInstant(iso: string, opts: FormatOptions = {}): string {
  return new Intl.DateTimeFormat(opts.locale ?? userLocale(), {
    timeZone: opts.zone ?? userTimeZone(),
    dateStyle: opts.dateStyle ?? 'medium',
    timeStyle: opts.timeStyle ?? 'short',
  }).format(new Date(iso))
}

/** `GMT+9`, `GMT-3` — 특정 시점의 오프셋 표기 */
export function zoneLabel(
  zone: string,
  at: string | Date = new Date(),
  locale = userLocale(),
): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(at))
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? zone
}

/**
 * 달력 날짜(`YYYY-MM-DD`)는 시간대 변환 없이 그대로. 생일을 브라질에서 봐도 3월 5일.
 * (`new Date('1998-03-05')` 는 UTC 자정이라 서쪽 시간대에서 하루 밀린다 — 그래서 직접 분해)
 */
export function formatDate(
  isoDate: string,
  opts: Pick<FormatOptions, 'locale' | 'dateStyle'> = {},
): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(opts.locale ?? userLocale(), {
    timeZone: 'UTC',
    dateStyle: opts.dateStyle ?? 'long',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

export type DualTime = { event: string; viewer: string | null }

/**
 * 이벤트 시간대와 보는 사람 시간대를 같이. 같은 오프셋이면 `viewer` 는 null.
 * 예: `{ event: '2026. 10. 5. 오후 9:00 GMT+9', viewer: '2026. 10. 5. 오전 9:00 GMT-3' }`
 */
export function formatDual(moment: ZonedMoment, opts: FormatOptions = {}): DualTime {
  const viewerZone = opts.zone ?? userTimeZone()
  const locale = opts.locale ?? userLocale()
  const styles = {
    dateStyle: opts.dateStyle ?? 'medium',
    timeStyle: opts.timeStyle ?? 'short',
  } as const
  const event = `${formatInstant(moment.at, { zone: moment.zone, locale, ...styles })} ${zoneLabel(moment.zone, moment.at, locale)}`
  const sameOffset = offsetMinutes(moment.zone, moment.at) === offsetMinutes(viewerZone, moment.at)
  const viewer = sameOffset
    ? null
    : `${formatInstant(moment.at, { zone: viewerZone, locale, ...styles })} ${zoneLabel(viewerZone, moment.at, locale)}`
  return { event, viewer }
}

/** 특정 시점에 그 시간대의 UTC 오프셋(분) */
export function offsetMinutes(zone: string, at: string | Date): number {
  const date = new Date(at)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return Math.round((asUtc - date.getTime()) / 60000)
}

/**
 * `datetime-local` 입력값(`2026-10-05T21:00`) + 시간대 → ZonedMoment. DST 틈은 뒤로, 중복은 앞 오프셋 (백엔드와 동일).
 */
export function toZonedMoment(local: string, zone: string): ZonedMoment {
  const [datePart, timePart = '00:00'] = local.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi, s = 0] = timePart.split(':').map(Number)
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi, s)
  const day = 86_400_000
  // 전이 전후의 오프셋을 모두 후보로 (하루 전/후를 같이 본다)
  const offsets = [
    ...new Set(
      [naiveUtc - day, naiveUtc, naiveUtc + day].map((t) => offsetMinutes(zone, new Date(t))),
    ),
  ]
  const instantFor = (off: number) => naiveUtc - off * 60_000
  // 그 오프셋으로 해석한 시점에서 실제 오프셋이 같으면 유효한 해석
  const valid = offsets.filter((off) => offsetMinutes(zone, new Date(instantFor(off))) === off)
  // 중복(둘 다 유효): 큰 오프셋 = 전이 전(여름) = 더 이른 시점. 틈(없음): 전이 전 오프셋(작은 쪽)으로 해석 → 틈 길이만큼 뒤로
  const chosen = valid.length > 0 ? Math.max(...valid) : Math.min(...offsets)
  const at = new Date(instantFor(chosen))
  const localNormalized = new Intl.DateTimeFormat('sv-SE', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .format(at)
    .replace(' ', 'T')
  return { local: localNormalized, zone, at: at.toISOString().replace('.000Z', 'Z') }
}

/** `3분 전`, `2일 후` — Intl.RelativeTimeFormat */
export function formatRelative(iso: string, opts: { now?: Date; locale?: string } = {}): string {
  const now = opts.now ?? new Date()
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(opts.locale ?? userLocale(), { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month')
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year')
}
