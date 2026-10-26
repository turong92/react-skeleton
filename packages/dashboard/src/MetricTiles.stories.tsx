import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, within } from 'storybook/test'
import { defaultDashboardLabels } from './labels'
import { MetricTiles } from './MetricTiles'
import { fakeOverview } from './stories/fakeDashboard'

function Selectable(props: Omit<ComponentProps<typeof MetricTiles>, 'selectedKey' | 'onSelect'>) {
  const [key, setKey] = useState<string | null>(props.metrics[0]?.key ?? null)
  return <MetricTiles {...props} selectedKey={key} onSelect={setKey} />
}

/** 숫자 타일 줄 - 눌리는 칸이라 호버 · 눌림 · 선택(`aria-pressed`)이 모두 다르게 보인다. 돈은 통화마다 한 줄 */
const meta = {
  title: 'Packages/dashboard/MetricTiles',
  component: MetricTiles,
  args: {
    metrics: fakeOverview().metrics,
    selectedKey: 'cloudflare.visits',
    onSelect: () => {},
    compare: true,
    locale: 'en-US',
    labels: defaultDashboardLabels,
  },
  render: (args) => <Selectable {...args} />,
} satisfies Meta<typeof MetricTiles>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const tiles = canvas.getAllByRole('button')
    await expect(tiles).toHaveLength(6)
    await userEvent.click(tiles[2])
    await expect(tiles[2]).toHaveAttribute('aria-pressed', 'true')
    await expect(tiles[0]).toHaveAttribute('aria-pressed', 'false')
    // 돈 타일: 둘째 통화 줄 + 직전 대비 증감, 활성 타일: 비교 불가
    const revenue = canvas.getByRole('button', { name: /Net revenue/ })
    await expect(within(revenue).getByText('$990.00')).toBeInTheDocument()
    await expect(
      within(canvas.getByRole('button', { name: /Active users/ })).getByText('Not comparable'),
    ).toBeInTheDocument()
    // 자세히 보기 링크는 단추 밖에
    await expect(canvas.getAllByRole('link', { name: 'See details' })).toHaveLength(2)
  },
}

export const CompareOff: Story = {
  args: { compare: false },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('vs previous period')).toBeNull()
    await expect(canvas.queryByText('Not comparable')).toBeNull()
  },
}

export const SourceMissing: Story = {
  args: { metrics: fakeOverview({ connected: false }).metrics },
  play: async ({ canvas }) => {
    const visits = canvas.getByRole('button', { name: /Visits/ })
    await expect(visits).toHaveTextContent('-')
    await expect(canvas.getByRole('button', { name: /Signed up/ })).toHaveTextContent('128')
  },
}
