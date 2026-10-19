import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { adminOrder } from '../test/fixtures'
import { AdminOrderTable, type AdminOrderFilter } from './AdminOrderTable'

/**
 * 운영자 결제 목록 — 이름 · 결제 번호 · 금액 · 결제 수단 · 상태 알약(확인 필요면 알약 하나와 이유 한 줄 더) · 시각, 줄 끝에 「자세히」 단추.
 * 줄 전체는 눌리지 않고 알약도 눌리지 않는다 — 누르는 것은 테두리 있는 「자세히」와 위의 「찾기」(상태 고르기는 바로 적용). 계정 id 는 이 표에 없다(한 건 화면에서 본다).
 * 보이기만 한다: 데이터 · 쪽 이동 · 호출은 부모. 라우터 링크는 `renderAction` 으로(버튼 모양 클래스를 링크에 붙인다).
 */
const orders = [
  adminOrder({ id: 'ord_1', orderName: '응원하기 3,000원' }),
  adminOrder({
    id: 'ord_2',
    orderName: '응원하기 1,000원',
    amount: { amount: 1000, currency: 'KRW' },
    status: 'CONFIRMING',
    card: null,
    method: 'EASY_PAY',
    easyPayBrand: 'KAKAOPAY',
    provider: 'toss',
    reviewReason: 'CONFIRM_UNRESOLVED',
  }),
  adminOrder({
    id: 'ord_3',
    orderName: '응원하기 5,000원',
    amount: { amount: 5000, currency: 'KRW' },
    status: 'PAID',
    refundPending: true,
    openRefundStatus: 'REQUESTED',
  }),
]

const meta = {
  title: 'Packages/payment/admin/AdminOrderTable',
  component: AdminOrderTable,
  args: {
    orders,
    onOpen: fn(),
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 1. 1. 오후 12:00',
  },
} satisfies Meta<typeof AdminOrderTable>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const table = canvas.getByRole('table', { name: '결제 목록' })
    const rows = within(table).getAllByRole('row').slice(1)
    await expect(rows).toHaveLength(3)
    await expect(within(rows[0]).getByText('응원하기 3,000원')).toBeVisible()
    await expect(within(rows[0]).getByText('ord_1')).toBeVisible()
    await expect(within(rows[0]).getByText('현대카드 ····1234')).toBeVisible()
    await expect(within(rows[0]).getByText('결제됨')).toBeVisible()
    await expect(within(rows[1]).getByText('카카오페이 · 토스 경유')).toBeVisible()
    await expect(within(rows[2]).getByText('환불 요청함')).toBeVisible()
    await expect(table).not.toHaveTextContent('acc_')
    await userEvent.click(within(rows[1]).getByRole('button', { name: '자세히: 응원하기 1,000원' }))
    await expect(args.onOpen).toHaveBeenCalledWith(orders[1])
  },
}

/** 확인 필요한 결제는 알약 하나와 이유 한 줄 — 코드는 그리지 않는다 */
export const NeedsACheck: Story = {
  play: async ({ canvas }) => {
    const row = canvas.getByRole('row', { name: /응원하기 1,000원/ })
    await expect(within(row).getByText('확인 필요')).toBeVisible()
    await expect(within(row).getByText('결제 결과를 끝내 확인하지 못했어요')).toBeVisible()
    await expect(canvas.getAllByText('확인 필요')).toHaveLength(1)
    await expect(canvas.queryByText('CONFIRM_UNRESOLVED')).toBeNull()
  },
}

export const OnlyTheDetailsButtonsArePressable: Story = {
  play: async ({ canvas }) => {
    // 줄 · 알약은 컨트롤이 아니다 — 눌리는 것은 「자세히」 세 개뿐
    await expect(canvas.getAllByRole('button')).toHaveLength(3)
    await expect(canvas.queryAllByRole('link')).toHaveLength(0)
    const detail = canvas.getAllByRole('button')[0]
    await expect(getComputedStyle(detail).borderTopWidth).not.toBe('0px')
    await expect(getComputedStyle(canvas.getByText('결제됨')).cursor).not.toBe('pointer')
  },
}

/** `renderAction` 의 정본 사용법 — 링크에 **넘겨 받은 버튼 모양 클래스**를 붙인다. 날 `<a>` 는 글자로만 보인다 */
export const LinkAction: Story = {
  args: {
    onOpen: undefined,
    renderAction: (order, label, name, className) => (
      <a className={className} href={`#/admin/payments/${order.id}`} aria-label={name}>
        {label}
      </a>
    ),
  },
  play: async ({ canvas }) => {
    const links = canvas.getAllByRole('link', { name: /^자세히: / })
    await expect(links).toHaveLength(3)
    for (const link of links) {
      const style = getComputedStyle(link)
      await expect(style.borderTopWidth).toBe('1px')
      await expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
      await expect(style.textDecorationLine).toBe('none')
      await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(36)
    }
  },
}

function Filtering({ onChange }: { onChange: (next: AdminOrderFilter) => void }) {
  const [filter, setFilter] = useState<AdminOrderFilter>({ status: '', q: '' })
  return (
    <AdminOrderTable
      orders={orders}
      onOpen={() => undefined}
      filter={filter}
      onFilterChange={(next) => {
        onChange(next)
        setFilter(next)
      }}
      labels={koPaymentLabels}
      locale="ko-KR"
      formatTime={() => '2026. 1. 1. 오후 12:00'}
    />
  )
}

function FilteringWithErased({ onChange }: { onChange: (next: AdminOrderFilter) => void }) {
  const [filter, setFilter] = useState<AdminOrderFilter>({ status: 'PAID', q: '' })
  return (
    <AdminOrderTable
      orders={[...orders, adminOrder({ id: 'ord_7', accountId: 'deleted:3f9a1c0b7d2e4a55' })]}
      onOpen={() => undefined}
      filter={filter}
      onFilterChange={(next) => {
        onChange(next)
        setFilter(next)
      }}
      showErasedToggle
      labels={koPaymentLabels}
      locale="ko-KR"
      formatTime={() => '2026. 1. 1. 오후 12:00'}
    />
  )
}

const onFilter = fn()

/** 상태를 고르면 바로 적용, 결제 번호는 「찾기」(또는 Enter)를 눌러야 적용 — 앞뒤 공백은 뗀다 */
export const Filter: Story = {
  beforeEach: () => onFilter.mockClear(),
  render: () => <Filtering onChange={onFilter} />,
  play: async ({ canvas, userEvent }) => {
    const search = canvas.getByRole('search', { name: '결제 찾기' })
    await userEvent.selectOptions(within(search).getByLabelText('상태'), 'PAID')
    await expect(onFilter).toHaveBeenLastCalledWith({ status: 'PAID', q: '' })
    const input = within(search).getByLabelText('결제 번호')
    await userEvent.type(input, '  ord_2 ')
    await expect(onFilter).toHaveBeenCalledTimes(1) // 적는 동안은 적용하지 않는다
    await userEvent.click(within(search).getByRole('button', { name: '찾기' }))
    await expect(onFilter).toHaveBeenLastCalledWith({ status: 'PAID', q: 'ord_2' })
    await userEvent.type(input, '{Enter}')
    await expect(onFilter).toHaveBeenCalledTimes(3)
    // 모든 상태 + 여덟 상태
    await expect(within(search).getAllByRole('option')).toHaveLength(9)
  },
}

/**
 * 서버는 탈퇴한 계정의 결제를 전체 목록에서 기본으로 숨긴다 - 스위치 「탈퇴한 계정의 결제도 보기」(켜고 끄는 모양이 늘 보이고 글자를 눌러도 된다)가 그것을 켠다.
 * 다른 조건은 그대로 가져간다. 계정 id 가 탈퇴 대체 값(`deleted:…`)이면 줄에 「탈퇴한 계정」이 붙는다(대체 값 자체는 표에 없다)
 */
export const ClosedAccountsSwitch: Story = {
  beforeEach: () => onFilter.mockClear(),
  render: () => <FilteringWithErased onChange={onFilter} />,
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole('switch', { name: '탈퇴한 계정의 결제도 보기' })
    await expect(toggle).not.toBeChecked()
    await expect(toggle).toHaveAccessibleDescription(
      '탈퇴한 계정의 결제는 기본으로 숨겨요. 확인 필요 탭과 결제 번호 찾기에서는 늘 보여요',
    )
    await userEvent.click(canvas.getByText('탈퇴한 계정의 결제도 보기')) // 글자를 눌러도 켜진다
    await expect(toggle).toBeChecked()
    await expect(onFilter).toHaveBeenLastCalledWith({ status: 'PAID', q: '', includeErased: true })
    await userEvent.click(toggle)
    await expect(onFilter).toHaveBeenLastCalledWith({ status: 'PAID', q: '', includeErased: false })
    // 줄: 탈퇴한 계정의 결제에만 알약
    const rows = canvas.getAllByRole('row')
    await expect(
      within(rows.find((row) => row.textContent?.includes('ord_7'))!).getByText('탈퇴한 계정'),
    ).toBeVisible()
    await expect(canvas.getAllByText('탈퇴한 계정')).toHaveLength(1)
    await expect(canvas.queryByText(/deleted:/)).toBeNull()
  },
}

export const NothingMatches: Story = {
  args: { orders: [], filter: { status: 'PAID', q: 'ord_x' }, onFilterChange: fn() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '찾는 결제가 없어요' })).toBeVisible()
    // 조건 줄은 남는다 — 조건을 고칠 수 있어야 한다
    await expect(canvas.getByRole('search', { name: '결제 찾기' })).toBeVisible()
    await expect(canvas.getByLabelText('결제 번호')).toHaveValue('ord_x')
  },
}

export const Empty: Story = {
  args: { orders: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '아직 결제가 없어요' })).toBeVisible()
  },
}

export const Loading: Story = {
  args: { orders: [], loading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('불러오는 중')
  },
}

/** 불러오기에 실패해도 받은 줄은 지우지 않는다 — 아래에 이유와 「다시 불러오기」 */
export const ErrorKeepsTheRows: Story = {
  args: { error: true, onRetry: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(within(canvas.getByRole('table')).getAllByRole('row')).toHaveLength(4)
    await expect(canvas.getByRole('alert')).toHaveTextContent('연결을 확인하고')
    await userEvent.click(canvas.getByRole('button', { name: '다시 불러오기' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

export const LoadMore: Story = {
  args: { onLoadMore: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await expect(args.onLoadMore).toHaveBeenCalled()
  },
}

export const English: Story = {
  args: { labels: undefined, locale: 'en-US' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Payments' })).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: /^Details: / })).toHaveLength(3)
    await expect(canvas.getAllByText('Needs a check')).toHaveLength(1)
  },
}

/** 320px · 375px — 페이지는 옆으로 밀리지 않는다(표 자리만 가로로 스크롤되고 키보드로도 닿는다) */
function InFrame({ width }: { width: string }) {
  return (
    <div data-testid="frame" style={{ width }}>
      <AdminOrderTable
        orders={orders}
        onOpen={() => undefined}
        filter={{ status: '', q: '' }}
        onFilterChange={() => undefined}
        labels={koPaymentLabels}
        locale="ko-KR"
        formatTime={() => '2026. 1. 1. 오후 12:00'}
      />
    </div>
  )
}

export const At320: Story = {
  render: () => <InFrame width="20rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
    await expect(canvas.getByRole('region', { name: '결제 목록' })).toHaveAttribute('tabindex', '0')
  },
}

export const At375: Story = {
  render: () => <InFrame width="23.4375rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}
