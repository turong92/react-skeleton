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
    // 막대는 서버 단계 셋만 - 방문(기준)은 막대가 아니라 위의 참고 줄
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
    await expect(
      canvas.getByText('Visits 12,480 - 1% of visits became Signed up'),
    ).toBeInTheDocument()
    // 단계의 비율은 서버의 rate(묶음 대비) 그대로 - 「전 단계 대비」를 다시 계산하지 않는다
    await expect(canvas.getByText('75% of Signed up')).toBeInTheDocument()
    await expect(canvas.getByText('43% of Signed up')).toBeInTheDocument()
    await expect(canvas.queryByText(/previous step/)).toBeNull()
  },
}

/** 단계가 겹쳐 서로 앞뒤 관계가 아닐 때(돌아옴 3 · 결제 5) - 「전 단계 대비 167%」가 아니라 묶음 대비(5/10 = 50%) */
export const OverlappingSteps: Story = {
  args: {
    funnel: {
      steps: [
        { key: 'a', label: 'Signed up', reached: 10, rate: 1 },
        { key: 'b', label: 'Came back', reached: 3, rate: 0.3 },
        { key: 'c', label: 'Paid', reached: 5, rate: 0.5 },
      ],
      reference: null,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('50% of Signed up')).toBeInTheDocument()
    await expect(canvas.queryByText(/167/)).toBeNull()
  },
}

export const WithoutReference: Story = {
  args: { funnel: fakeOverview({ connected: false }).funnel! },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
    await expect(canvas.getByText('Start')).toBeInTheDocument()
    await expect(canvas.queryByText(/of visits became/)).toBeNull()
  },
}

export const Empty: Story = {
  args: { funnel: { steps: [], reference: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No funnel data yet')).toBeInTheDocument()
  },
}
