import { Table } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { formatDate, formatDual, formatInstant, formatRelative, toZonedMoment } from './format'

/**
 * 시각 3종 — 일어난 시점(`formatInstant`, ISO `...Z`) · 달력 날짜(`formatDate`, `YYYY-MM-DD` — 시간대 변환 없음) ·
 * 예정된 현지 시각(`ZonedMoment` → `formatDual`, 이벤트 시간대 + 내 시간대). `new Date('YYYY-MM-DD')` 는 쓰지 않는다.
 * 같은 값이 보는 사람의 시간대마다 어떻게 보이는지를 표로 보인다.
 */
const INSTANT = '2026-10-05T12:00:00Z'
const ZONES = ['Asia/Seoul', 'Europe/London', 'America/New_York', 'Australia/Sydney']
const EVENT = toZonedMoment('2026-10-05T21:00', 'Asia/Seoul')

const rows = ZONES.map((zone) => ({
  zone,
  instant: formatInstant(INSTANT, { zone, locale: 'en-US' }),
  dual: formatDual(EVENT, { zone, locale: 'en-US' }),
}))

function Formats() {
  return (
    <>
      <Table
        caption={`formatInstant('${INSTANT}', { zone }) — the same moment, per viewer time zone`}
        columns={[
          {
            key: 'zone',
            header: 'Viewer zone',
            render: (r: (typeof rows)[number]) => r.zone,
            rowHeader: true,
          },
          { key: 'instant', header: 'Shown as', render: (r) => r.instant },
        ]}
        rows={rows}
        rowKey={(r) => r.zone}
      />
      <Table
        caption={`formatDual(ZonedMoment ${EVENT.local} ${EVENT.zone}) — event time zone and viewer time zone`}
        columns={[
          {
            key: 'zone',
            header: 'Viewer zone',
            render: (r: (typeof rows)[number]) => r.zone,
            rowHeader: true,
          },
          { key: 'event', header: 'Event local', render: (r) => r.dual.event },
          { key: 'viewer', header: 'Viewer', render: (r) => r.dual.viewer ?? '(same offset)' },
        ]}
        rows={rows}
        rowKey={(r) => r.zone}
      />
      <p>
        formatDate(&apos;1998-03-05&apos;) →{' '}
        <output aria-label="Calendar date">{formatDate('1998-03-05', { locale: 'en-US' })}</output>
      </p>
      <p>
        formatRelative →{' '}
        <output aria-label="Relative">
          {formatRelative('2026-10-05T11:57:00Z', { now: new Date(INSTANT), locale: 'en-US' })}
        </output>
      </p>
    </>
  )
}

const meta = {
  title: 'Packages/time/Formats',
  component: Formats,
} satisfies Meta<typeof Formats>
export default meta
type Story = StoryObj<typeof meta>

export const ThreeKindsOfTime: Story = {
  play: async ({ canvas }) => {
    // 같은 순간이 시간대마다 다른 시각으로 보인다(정오 UTC = 서울 21:00 · 런던 13:00 …)
    const instantRows = within(canvas.getByRole('table', { name: /formatInstant/ }))
    await expect(instantRows.getByRole('row', { name: /Asia\/Seoul/ })).toHaveTextContent('9:00')
    await expect(instantRows.getByRole('row', { name: /Europe\/London/ })).toHaveTextContent('1:00')
    // 달력 날짜는 시간대로 밀리지 않는다
    await expect(canvas.getByLabelText('Calendar date')).toHaveTextContent('March 5, 1998')
    await expect(canvas.getByLabelText('Relative')).toHaveTextContent('3 minutes ago')
  },
}
