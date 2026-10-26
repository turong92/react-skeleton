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
