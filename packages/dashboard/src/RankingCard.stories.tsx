import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { defaultDashboardLabels } from './labels'
import { RankingCard } from './RankingCard'
import { fakeOverview } from './stories/fakeDashboard'

const rankings = fakeOverview().rankings

/** 순위 카드 - 카드 하나에 같은 묶음의 순위를 탭으로. 출처가 없는 탭만 안내 상자, 탭마다 출처 배지 · 신선도 · 「전체 보기」 */
const meta = {
  title: 'Packages/dashboard/RankingCard',
  component: RankingCard,
  args: {
    group: 'traffic',
    rankings: rankings.filter((r) => r.group === 'traffic'),
    zone: 'Asia/Seoul',
    includesToday: false,
    locale: 'en-US',
    labels: defaultDashboardLabels,
    onViewAll: fn(),
  },
} satisfies Meta<typeof RankingCard>
export default meta
type Story = StoryObj<typeof meta>

export const Tabs: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('heading', { name: 'Traffic' })).toBeInTheDocument()
    await expect(canvas.getByText('google.com')).toBeInTheDocument()
    // 출처가 없는 탭은 안내만 - 다른 탭은 그대로
    await userEvent.click(canvas.getByRole('tab', { name: 'Channels' }))
    await expect(
      await within(canvas.getByRole('tabpanel', { name: 'Channels' })).findByText(
        'Add Google Analytics credentials to see this',
      ),
    ).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: 'Sources' }))
    const panel = canvas.getByRole('tabpanel', { name: 'Sources' })
    await userEvent.click(within(panel).getByRole('button', { name: /View all/ }))
    await expect(args.onViewAll).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'cloudflare.referrers' }),
    )
  },
}

/** 오늘이 든 기간: Cloudflare 는 「약 n분 전 기준」, GA 는 「GA 는 어제까지(n시 적재)」 */
export const TodayFreshness: Story = {
  args: {
    includesToday: true,
    now: Date.parse('2026-10-26T04:35:00Z'),
    rankings: [
      {
        ...rankings[0],
        freshness: { kind: 'CACHED', asOf: '2026-10-26T04:30:00Z' },
      },
      {
        ...rankings[0],
        key: 'ga.channels',
        source: 'ga',
        label: 'Channels',
        freshness: { kind: 'DAILY', asOf: '2026-10-26T04:30:00Z' },
      },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('About 5 min ago')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: 'Channels' }))
    await expect(canvas.getByText('GA through yesterday (loaded 13:00)')).toBeInTheDocument() // 마지막 적재 서울 13:30
    await expect(canvas.queryByText(/tomorrow/)).toBeNull()
  },
}

export const SingleRanking: Story = {
  args: { group: 'app', rankings: rankings.filter((r) => r.group === 'app') },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('tablist')).toBeNull()
    await expect(canvas.getByText('Birthday board')).toBeInTheDocument()
  },
}

/** Cloudflare 의 국가는 코드(KR)로 온다 - 이름으로 보인다(모르는 코드 XX 는 그대로) */
export const CountryNames: Story = {
  args: { group: 'geo', rankings: rankings.filter((r) => r.group === 'geo') },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('South Korea')).toBeInTheDocument()
    await expect(canvas.getByText('United States')).toBeInTheDocument()
    await expect(canvas.getByText('XX')).toBeInTheDocument()
    await expect(canvas.queryByText('KR')).toBeNull()
  },
}
