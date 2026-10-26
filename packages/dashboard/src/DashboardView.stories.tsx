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

function Demo({
  options,
  korean,
  zone = 'Asia/Seoul',
  onApi,
}: {
  options?: FakeDashboardOptions
  korean?: boolean
  zone?: string
  onApi?: (fake: ReturnType<typeof createFakeDashboardApi>) => void
}) {
  const [fake] = useState(() => {
    const created = createFakeDashboardApi(options)
    onApi?.(created)
    return created
  })
  const { api } = fake
  return (
    <WithQuery>
      <DashboardView
        api={api}
        zone={zone || undefined}
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

/** 시간대를 주지 않으면 서버가 알려 준다 - 첫 호출은 기간 없이(오늘), 그다음 기간은 응답의 `range.zone` 으로 센다 */
export const ZoneFromServer: Story = {
  render: () => (
    <Demo
      zone=""
      onApi={(fake) => {
        zoneProbe = fake
      }}
    />
  ),
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Visits over time' })
    const calls = zoneProbe!.calls.overview
    await expect(calls[0]).toEqual({ from: null, to: null, compare: false })
    const span = calls.find((call) => call.from !== null)!
    await expect(span.to! >= span.from!).toBe(true)
  },
}

let zoneProbe: ReturnType<typeof createFakeDashboardApi> | undefined

export const Realtime: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '7 online now' }))
    const dialog = await screen.findByRole('dialog', { name: 'Right now' })
    await expect(
      within(dialog).getByText(/visitors who accepted analytics cookies/),
    ).toBeInTheDocument()
    await expect(within(dialog).getByText('/s/sample-birthday')).toBeInTheDocument()
    await expect(within(dialog).getByText('South Korea')).toBeInTheDocument()
  },
}

export const NoRealtime: Story = {
  render: () => <Demo options={{ realtime: false }} />,
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Visits over time' })
    await expect(canvas.queryByRole('button', { name: /online now/ })).toBeNull()
  },
}

/** 재방문(`ga.returning`)은 탭이 아니라 숫자 카드 - 「New」 · 「Returning」 두 행에서 비율을 계산한다(120 / 500 = 24%) */
export const ReturningVisitors: Story = {
  render: () => <Demo />,
  play: async ({ canvas }) => {
    const card = await canvas.findByRole('article', { name: 'Returning visitors' })
    await expect(within(card).getByText('24%')).toBeInTheDocument()
    await expect(within(card).getByText('120')).toBeInTheDocument()
    // 유입 카드의 탭에는 없다
    const traffic = canvas.getByRole('article', { name: 'Traffic' })
    await expect(within(traffic).queryByRole('tab', { name: /Returning/ })).toBeNull()
  },
}

/** 퍼널의 묶음이 너무 크면(5만 계정 초과) 막대 대신 「기간을 줄여 주세요」 안내 - 다른 카드는 그대로 */
export const FunnelTooLarge: Story = {
  render: () => <Demo options={{ funnelStatus: 'TOO_LARGE' }} />,
  play: async ({ canvas }) => {
    const card = await canvas.findByRole('article', { name: 'Funnel' })
    await expect(within(card).getByText(/too long to count the funnel/)).toBeInTheDocument()
    await expect(within(card).queryByRole('listitem')).toBeNull()
    await expect(canvas.getByRole('article', { name: 'Traffic' })).toBeInTheDocument()
  },
}
