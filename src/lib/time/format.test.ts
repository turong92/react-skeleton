import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDual,
  formatInstant,
  formatRelative,
  offsetMinutes,
  toZonedMoment,
  zoneLabel,
} from './format'
import { createServerClock } from './server-clock'
import { defaultZoneOf, isSingleZone, zonesOf } from './country'

const deadline = { local: '2026-10-05T21:00:00', zone: 'Asia/Seoul', at: '2026-10-05T12:00:00Z' }

describe('formatInstant / zoneLabel', () => {
  it('보는 사람 시간대·로케일로 바꾸고 오프셋 표기를 쓴다', () => {
    // 오전/오후 표기는 ICU 빌드에 따라 "오후"/"PM" 이 갈려서 날짜·시각만 단정
    expect(formatInstant(deadline.at, { zone: 'Asia/Seoul', locale: 'ko-KR' })).toMatch(
      /^2026\. 10\. 5\. .*9:00$/,
    )
    expect(formatInstant(deadline.at, { zone: 'America/Sao_Paulo', locale: 'pt-BR' })).toMatch(
      /5 de out\. de 2026,? 09:00/,
    )
    expect(zoneLabel('Asia/Seoul', deadline.at, 'en-US')).toBe('GMT+9')
    expect(zoneLabel('America/Sao_Paulo', deadline.at, 'en-US')).toBe('GMT-3')
  })
})

describe('formatDate', () => {
  it('달력 날짜는 시간대와 무관하게 같은 날', () => {
    expect(formatDate('1998-03-05', { locale: 'en-US' })).toBe('March 5, 1998')
    expect(formatDate('1998-03-05', { locale: 'ko-KR' })).toBe('1998년 3월 5일')
  })
})

describe('formatDual', () => {
  it('이벤트 시간대 + 보는 사람 시간대, 같은 오프셋이면 viewer 없음', () => {
    const d = formatDual(deadline, { zone: 'America/Sao_Paulo', locale: 'en-US' })
    expect(d.event).toMatch(/9:00 PM GMT\+9$/)
    expect(d.viewer).toMatch(/9:00 AM GMT-3$/)
    expect(formatDual(deadline, { zone: 'Asia/Tokyo', locale: 'en-US' }).viewer).toBeNull()
  })
})

describe('toZonedMoment', () => {
  it('datetime-local 입력을 시간대와 합쳐 백엔드와 같은 at 을 만든다', () => {
    expect(toZonedMoment('2026-10-05T21:00', 'Asia/Seoul')).toEqual(deadline)
  })
  it('DST 틈은 뒤로 (베를린 2026-03-29 02:30 → 03:30 CEST), 중복은 앞 오프셋 (2026-10-25 02:30 → +02:00)', () => {
    const gap = toZonedMoment('2026-03-29T02:30', 'Europe/Berlin')
    expect(gap.local).toBe('2026-03-29T03:30:00')
    expect(gap.at).toBe('2026-03-29T01:30:00Z')
    const overlap = toZonedMoment('2026-10-25T02:30', 'Europe/Berlin')
    expect(overlap.at).toBe('2026-10-25T00:30:00Z')
  })
  it('offsetMinutes', () => {
    expect(offsetMinutes('Asia/Seoul', deadline.at)).toBe(540)
    expect(offsetMinutes('America/Sao_Paulo', deadline.at)).toBe(-180)
  })
})

describe('formatRelative', () => {
  it('상대 시간', () => {
    const now = new Date('2026-10-05T11:57:00Z')
    expect(formatRelative(deadline.at, { now, locale: 'ko' })).toBe('3분 후')
    expect(formatRelative('2026-10-03T12:00:00Z', { now, locale: 'en' })).toBe('2 days ago')
  })
})

describe('createServerClock', () => {
  it('Date 헤더로 오프셋을 잡는다', () => {
    let local = Date.parse('2026-10-05T12:00:00Z')
    const clock = createServerClock(() => local)
    clock.observe(new Response(null, { headers: { date: 'Mon, 05 Oct 2026 12:05:00 GMT' } }))
    expect(clock.offsetMs()).toBe(5 * 60 * 1000)
    local += 1000
    expect(clock.now().toISOString()).toBe('2026-10-05T12:05:01.000Z')
  })
})

describe('country → zones', () => {
  it('단일/복수 국가', () => {
    expect(defaultZoneOf('KR')).toBe('Asia/Seoul')
    expect(isSingleZone('jp')).toBe(true)
    expect(defaultZoneOf('US')).toBe('America/New_York')
    expect(zonesOf('US')).toContain('America/Los_Angeles')
    expect(zonesOf('XX')).toEqual([])
  })
})
