import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { defaultDashboardLabels } from '../labels'
import { fakeOverview } from '../stories/fakeDashboard'
import { FunnelBars } from './FunnelBars'

/** 퍼널 막대 - 기준(방문)이 있으면 맨 앞 단계, 막대 길이는 첫 단계 대비 도달 수, 글자는 전 단계 대비 비율 */
const meta = {
  title: 'Packages/dashboard/FunnelBars',
  component: FunnelBars,
  args: { funnel: fakeOverview().funnel!, labels: defaultDashboardLabels, locale: 'en-US' },
} satisfies Meta<typeof FunnelBars>
export default meta
type Story = StoryObj<typeof meta>

export const WithReference: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4)
    await expect(canvas.getByText('12,480')).toBeInTheDocument()
    await expect(canvas.getByText('1% of the previous step')).toBeInTheDocument() // 방문 → 가입 128 / 12,480
    await expect(canvas.getByText('Visits to Paid 0.3%')).toBeInTheDocument()
    await expect(canvas.getByText('43% of Signed up')).toBeInTheDocument() // 서버 rate(묶음 대비)
  },
}

export const WithoutReference: Story = {
  args: { funnel: fakeOverview({ connected: false }).funnel! },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
    await expect(canvas.getByText('Start')).toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { funnel: { steps: [], reference: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No funnel data yet')).toBeInTheDocument()
  },
}
