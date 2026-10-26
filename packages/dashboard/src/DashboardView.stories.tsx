import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactNode } from 'react'
import { expect, screen, waitFor, within } from 'storybook/test'
import { DashboardView } from './DashboardView'
import { koDashboardLabels } from './labels'
import { createFakeDashboardApi, type FakeDashboardOptions } from './stories/fakeDashboard'

/**
 * 관리자 대시보드 한 덩어리 - 헤더(기간 · 비교) → 숫자 타일 + 큰 그래프 → 순위 카드 → 퍼널 → 앱 통계.
 * 데이터는 `api`(`createDashboardApi` 의 결과)로 주입한다 - 여기서는 메모리 안의 가짜(`stories/fakeDashboard.ts`). `QueryClientProvider` 아래에서 쓴다.
 * 새 화면은 `DashboardView` 를 그대로 쓰거나, 부품(`MetricTiles` · `MetricChart` · `RankingCard` · `FunnelBars`)으로 다시 짠다.
 */
function WithQuery({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function Demo({ options, korean }: { options?: FakeDashboardOptions; korean?: boolean }) {
  const [{ api }] = useState(() => createFakeDashboardApi(options))
  return (
    <WithQuery>
      <DashboardView
        api={api}
        zone="Asia/Seoul"
        locale={korean ? 'ko-KR' : 'en-US'}
        labels={korean ? koDashboardLabels : undefined}
        subtitle="Acme - operations"
      />
    </WithQuery>
  )
}

const meta = {
  title: 'Packages/dashboard/DashboardView',
  component: DashboardView,
  parameters: { layout: 'padded' },
  args: { api: createFakeDashboardApi().api },
} satisfies Meta<typeof DashboardView>
export default meta
type Story = StoryObj<typeof meta>

export const Connected: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    // 처음에는 첫 타일(방문)이 그래프에 올라 있다
    await expect(
      await canvas.findByRole('heading', { name: 'Visits over time' }),
    ).toBeInTheDocument()
    const visits = canvas.getByRole('button', { name: /Visits/ })
    await expect(visits).toHaveAttribute('aria-pressed', 'true')
    // 타일을 누르면 그래프 제목이 그 지표로 바뀌고 누른 타일이 눌린 모양이 된다
    const revenue = canvas.getByRole('button', { name: /Net revenue/ })
    await userEvent.click(revenue)
    await expect(canvas.getByRole('heading', { name: 'Net revenue over time' })).toBeInTheDocument()
    await expect(revenue).toHaveAttribute('aria-pressed', 'true')
    await expect(visits).toHaveAttribute('aria-pressed', 'false')
    // 돈 타일: 첫 통화는 큰 숫자, 둘째 통화는 아래 줄
    await expect(within(revenue).getByText('$990.00')).toBeInTheDocument()
    // 직전 기간을 줄 수 없는 타일(활성 이용자)은 증감 대신 「Not comparable」
    const active = canvas.getByRole('button', { name: /Active users/ })
    await expect(within(active).getByText('Not comparable')).toBeInTheDocument()
    await expect(
      within(canvas.getByRole('button', { name: /Signed up/ })).getByText(/▲/),
    ).toBeInTheDocument()
  },
}

export const CompareOff: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const visits = await canvas.findByRole('button', { name: /Visits/ })
    await expect(within(visits).getByText(/▲/)).toBeInTheDocument()
    const compare = canvas.getByRole('button', { name: /Compare with previous period/ })
    await expect(compare).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(compare)
    await waitFor(() =>
      expect(within(canvas.getByRole('button', { name: /Visits/ })).queryByText(/▲/)).toBeNull(),
    )
    await expect(canvas.queryByText('Previous period')).toBeNull()
  },
}

export const KeysMissing: Story = {
  render: () => <Demo options={{ connected: false }} />,
  play: async ({ canvas, userEvent }) => {
    // DB 타일 · 퍼널은 숫자, Cloudflare · GA 는 빈 상태 안내
    await expect(await canvas.findByRole('button', { name: /Signed up/ })).toHaveTextContent('128')
    await expect(canvas.getByRole('button', { name: /Visits/ })).toHaveTextContent('-')
    // 처음 올라 있는 지표(방문)는 출처가 없어 그래프 자리에 안내
    await expect(
      await within(await canvas.findByRole('region', { name: /Visits over time/ })).findByText(
        'Add a Cloudflare token to see this',
      ),
    ).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: 'Channels' }))
    await expect(
      await within(canvas.getByRole('tabpanel', { name: 'Channels' })).findByText(
        'Add Google Analytics credentials to see this',
      ),
    ).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Funnel' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3) // 방문 기준 없이 가입 · 활성 · 결제
  },
}

export const Korean: Story = {
  render: () => <Demo korean />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '방문 추이' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: '오늘' })).toBeInTheDocument()
    await expect(canvas.getByRole('tab', { name: '소스' })).toBeInTheDocument()
  },
}

export const Loading: Story = {
  render: () => <Demo options={{ delayMs: 60_000 }} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('status')).toHaveTextContent('Loading the dashboard')
  },
}

export const LoadFailed: Story = {
  render: () => <Demo options={{ failing: true }} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The dashboard could not be loaded',
    )
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  },
}

export const ViewAll: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const card = (await canvas.findByRole('article', { name: 'Traffic' })) as HTMLElement
    await userEvent.click(within(card).getAllByRole('button', { name: /View all/ })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Sources - all' })
    await expect(await within(dialog).findByText('item-20')).toBeInTheDocument()
  },
}

/** 폰 너비(414px): 타일 2열 · 카드 1열 - 페이지가 옆으로 밀리지 않는다 */
export const PhoneWidthHasNoSideScroll: Story = {
  render: () => <Demo />,
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Visits over time' })
    await expect(window.innerWidth).toBeLessThanOrEqual(430)
    const root = document.documentElement
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
  },
}
