import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, waitFor } from 'storybook/test'
import { fakeOverview } from '../stories/fakeDashboard'
import { TrendChart } from './TrendChart'

const revenue = fakeOverview().metrics.find((m) => m.key === 'payment.net-revenue')!

/** SVG 선 그래프 - 실선(이번 기간) + 점선(직전 기간), 가리키면 그 시점의 값이 툴팁으로. 차트 라이브러리 없이 직접 그린다 */
const meta = {
  title: 'Packages/dashboard/TrendChart',
  component: TrendChart,
  args: {
    points: revenue.series ?? [],
    previous: revenue.previousSeries,
    interval: 'DAY',
    zone: 'Asia/Seoul',
    locale: 'en-US',
    formatValue: (value: number) => `KRW ${value.toLocaleString('en-US')}`,
    label: 'Net revenue chart',
    currentLabel: 'This period',
    previousLabel: 'Previous period',
  },
} satisfies Meta<typeof TrendChart>
export default meta
type Story = StoryObj<typeof meta>

export const WithPreviousPeriod: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('img', { name: 'Net revenue chart' })).toBeInTheDocument()
    await expect(canvas.getByText('Previous period')).toBeInTheDocument()
    const chart = canvasElement.querySelector('svg')!.parentElement!
    const box = chart.getBoundingClientRect()
    fireEvent.pointerMove(chart, { clientX: box.left + box.width / 2, clientY: box.top + 10 })
    await waitFor(() => expect(canvasElement.textContent).toMatch(/This period KRW/))
    await expect(canvasElement.textContent).toMatch(/Previous period KRW/)
  },
}

export const WithoutComparison: Story = {
  args: { previous: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('This period')).toBeInTheDocument()
    await expect(canvas.queryByText('Previous period')).toBeNull()
  },
}

export const Hourly: Story = {
  args: {
    interval: 'HOUR',
    previous: null,
    points: Array.from({ length: 24 }, (_, hour) => ({
      at: new Date(Date.UTC(2026, 9, 25, 15 + hour)).toISOString(),
      value: 10 + ((hour * 7) % 13),
    })),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toMatch(/00:00/)
  },
}

/** 환불이 결제보다 큰 칸(순매출 음수)은 잘리지 않는다 - 바닥이 내려가고 0 기준선이 생긴다 */
export const NegativeValues: Story = {
  args: {
    previous: null,
    points: [
      { at: '2026-10-19T15:00:00Z', value: 12_000 },
      { at: '2026-10-20T15:00:00Z', value: -7_000 },
      { at: '2026-10-21T15:00:00Z', value: 4_000 },
    ],
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg')!
    await expect(svg.querySelector('line[class*="zero"]')).not.toBeNull()
    const ys = [...svg.querySelectorAll('polyline')].flatMap((line) =>
      (line.getAttribute('points') ?? '').split(' ').map((pair) => Number(pair.split(',')[1])),
    )
    // 모든 점이 그림(0~40) 안에 있다
    await expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    await expect(Math.max(...ys)).toBeLessThanOrEqual(40)
  },
}
