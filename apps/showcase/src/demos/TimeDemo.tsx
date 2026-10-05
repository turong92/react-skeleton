import {
  formatDate,
  formatDual,
  formatInstant,
  formatRelative,
  toZonedMoment,
  zoneLabel,
} from '@skeleton/time'
import { Table } from '@skeleton/ui'
import { Case } from '../components/Section'

const INSTANT = '2026-10-05T12:00:00Z'
const ZONES = [
  'Asia/Seoul',
  'Europe/London',
  'America/New_York',
  'America/Sao_Paulo',
  'Australia/Sydney',
]
const EVENT = toZonedMoment('2026-10-05T21:00', 'Asia/Seoul')
const rows = ZONES.map((zone) => ({
  zone,
  offset: zoneLabel(zone, INSTANT, 'en-US'),
  instant: formatInstant(INSTANT, { zone, locale: 'ko-KR' }),
  dual: formatDual(EVENT, { zone, locale: 'ko-KR' }),
}))

/** 시각 3종 — 일어난 시점(`formatInstant`) · 달력 날짜(`formatDate`) · 예정된 현지 시각(`ZonedMoment` → `formatDual`) */
export function TimeDemo() {
  return (
    <>
      <Case label={`formatInstant('${INSTANT}', { zone })`}>
        <Table
          caption="같은 순간, 보는 사람의 시간대마다"
          columns={[
            { key: 'zone', header: '시간대', render: (r) => r.zone, rowHeader: true },
            { key: 'offset', header: '오프셋', render: (r) => r.offset },
            { key: 'instant', header: '표시', render: (r) => r.instant },
          ]}
          rows={rows}
          rowKey={(r) => r.zone}
        />
      </Case>
      <Case label={`formatDual(ZonedMoment ${EVENT.local} ${EVENT.zone})`}>
        <Table
          caption="서울 21:00 이벤트 — 이벤트 시간대와 보는 사람 시간대"
          columns={[
            { key: 'zone', header: '보는 사람', render: (r) => r.zone, rowHeader: true },
            { key: 'event', header: '이벤트 현지', render: (r) => r.dual.event },
            { key: 'viewer', header: '내 시간대', render: (r) => r.dual.viewer ?? '(같은 오프셋)' },
          ]}
          rows={rows}
          rowKey={(r) => r.zone}
        />
      </Case>
      <Case label="formatDate('1998-03-05') — 시간대 변환 없음">
        <p>{formatDate('1998-03-05', { locale: 'ko-KR' })}</p>
      </Case>
      <Case label="formatRelative">
        <p>{formatRelative('2026-10-05T11:57:00Z', { now: new Date(INSTANT), locale: 'ko-KR' })}</p>
      </Case>
    </>
  )
}
