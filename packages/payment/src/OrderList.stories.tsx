import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { koPaymentLabels } from './labels'
import { OrderList } from './OrderList'
import { order } from './test/fixtures'

/**
 * 결제 내역 — 줄마다 이름(`orderName` 그대로) · 금액 · 결제 수단(「현대카드 ····1234」) · 시각 · 상태 알약, 줄 끝에 「자세히」 단추.
 * 줄 전체는 눌리지 않고 알약도 눌리지 않는다 — 누르는 것은 채워진 테두리의 「자세히」 하나. 카드 칸이 없으면 수단 종류만(「간편결제」), 모르는 카드사는 「카드」.
 * 보이기만 한다: 쪽 이동은 부모(`onLoadMore`), 상세로 가는 링크는 `renderAction` 으로(라우터의 링크 단추).
 */
const orders = [
  order({ id: 'ord_1', orderName: '응원하기 3,000원' }),
  order({
    id: 'ord_2',
    orderName: '응원하기 1,000원',
    amount: { amount: 1000, currency: 'KRW' },
    status: 'PARTIALLY_REFUNDED',
    refundedAmount: 500,
    card: { issuer: 'NO_SUCH_BANK', last4: '9876' },
  }),
  order({
    id: 'ord_3',
    orderName: '응원하기 5,000원',
    amount: { amount: 5000, currency: 'KRW' },
    status: 'PAID',
    refundPending: true,
    openRefundStatus: 'PENDING',
    method: 'EASY_PAY',
    card: null,
  }),
]

const meta = {
  title: 'Packages/payment/OrderList',
  component: OrderList,
  args: {
    orders,
    onOpen: fn(),
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 1. 1. 오후 12:00',
  },
} satisfies Meta<typeof OrderList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const list = canvas.getByRole('list', { name: '결제 내역' })
    const rows = within(list).getAllByRole('listitem')
    await expect(rows).toHaveLength(3)
    await expect(within(rows[0]).getByText('응원하기 3,000원')).toBeVisible()
    await expect(within(rows[0]).getByText('3,000원')).toBeVisible()
    await expect(within(rows[0]).getByText('현대카드 ····1234')).toBeVisible()
    await expect(within(rows[0]).getByText('결제됨')).toBeVisible()
    await expect(within(rows[1]).getByText('카드 ····9876')).toBeVisible() // 모르는 카드사 코드
    await expect(within(rows[1]).getByText('일부 환불됨')).toBeVisible()
    await expect(within(rows[2]).getByText('간편결제')).toBeVisible() // 카드 칸이 없으면 수단 종류만
    await expect(within(rows[2]).getByText('환불 중')).toBeVisible()
    // 계정 · 주문 id 같은 내부 값은 그리지 않는다
    await expect(list).not.toHaveTextContent('ord_')

    await userEvent.click(within(rows[1]).getByRole('button', { name: '자세히: 응원하기 1,000원' }))
    await expect(args.onOpen).toHaveBeenCalledWith(orders[1])
  },
}

export const OnlyTheDetailsButtonIsPressable: Story = {
  play: async ({ canvas }) => {
    // 줄 · 알약은 컨트롤이 아니다 — 눌리는 것은 「자세히」 세 개뿐
    await expect(canvas.getAllByRole('button')).toHaveLength(3)
    await expect(canvas.queryAllByRole('link')).toHaveLength(0)
    const detail = canvas.getAllByRole('button')[0]
    await expect(getComputedStyle(detail).borderTopWidth).not.toBe('0px')
    await expect(getComputedStyle(canvas.getByText('결제됨')).cursor).not.toBe('pointer')
  },
}

/**
 * `renderAction` 의 정본 사용법 — 링크에 **넘겨 받은 네 번째 인자(버튼 모양 클래스)** 를 `className` 으로 붙인다.
 * 날 `<a>` 는 `base.css` 에서 밑줄도 테두리도 없는 본문 글자가 되어 눌리는 것으로 안 보인다. 라우터를 쓰면 `<Link className={className} to=… aria-label={name}>{label}</Link>`.
 */
export const LinkAction: Story = {
  args: {
    onOpen: undefined,
    renderAction: (o, label, name, className) => (
      <a className={className} href={`#/payments/${o.id}`} aria-label={name}>
        {label}
      </a>
    ),
  },
  play: async ({ canvas }) => {
    const links = canvas.getAllByRole('link', { name: /^자세히: / })
    await expect(links).toHaveLength(3)
    // 글자만 있는 링크가 아니다 — 쉬는 상태에서 테두리와 바탕이 있고, 높이는 눌리기 좋게 (작은 단추는 36px 이상)
    for (const link of links) {
      const style = getComputedStyle(link)
      await expect(style.borderTopWidth).toBe('1px')
      await expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)')
      await expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
      await expect(style.textDecorationLine).toBe('none')
      await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(36)
    }
    // 같은 줄 끝의 단추(`onOpen`)와 같은 테두리 — 어느 쪽을 써도 한 모양
    await expect(getComputedStyle(links[0]).borderTopColor).toBe(
      getComputedStyle(links[2]).borderTopColor,
    )
  },
}

/** 환불을 요청만 한 줄은 「환불 요청함」, 진행 중인 줄은 「환불 중」 — 돈이 움직였는지가 다르다 */
export const RefundRequestedIsNotRefundInProgress: Story = {
  args: {
    orders: [
      order({
        id: 'ord_a',
        orderName: '요청만 함',
        refundPending: true,
        openRefundStatus: 'REQUESTED',
      }),
      order({
        id: 'ord_b',
        orderName: '진행 중',
        refundPending: true,
        openRefundStatus: 'PENDING',
      }),
    ],
  },
  play: async ({ canvas }) => {
    const rows = within(canvas.getByRole('list', { name: '결제 내역' })).getAllByRole('listitem')
    await expect(within(rows[0]).getByText('환불 요청함')).toBeVisible()
    await expect(within(rows[0]).queryByText('환불 중')).toBeNull()
    await expect(within(rows[1]).getByText('환불 중')).toBeVisible()
  },
}

export const LoadMore: Story = {
  args: { onLoadMore: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '더 보기' }))
    await expect(args.onLoadMore).toHaveBeenCalled()
  },
}

/** 다음 쪽을 불러오다 실패해도 이미 받은 줄은 그대로 — 이유와 「다시 불러오기」가 줄 아래에 붙는다 */
export const RowsStayWhenALaterLoadFails: Story = {
  args: { error: true, onRetry: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(
      within(canvas.getByRole('list', { name: '결제 내역' })).getAllByRole('listitem'),
    ).toHaveLength(3)
    await expect(canvas.getByRole('alert')).toHaveTextContent('연결을 확인하고')
    await userEvent.click(canvas.getByRole('button', { name: '다시 불러오기' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

export const RowsStayWhileALaterLoadRuns: Story = {
  args: { loading: true },
  play: async ({ canvas }) => {
    await expect(
      within(canvas.getByRole('list', { name: '결제 내역' })).getAllByRole('listitem'),
    ).toHaveLength(3)
    await expect(canvas.getByRole('status')).toHaveTextContent('불러오는 중')
  },
}

/** 한국어 화면에서 「더 보기」가 일하는 동안에도 스피너가 한국어로 읽힌다 */
export const LoadingMoreIsNamedInKorean: Story = {
  args: { onLoadMore: fn(), loadingMore: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /불러오는 중/ })).toBeDisabled()
    await expect(canvas.queryByText('Loading')).toBeNull()
  },
}

export const Empty: Story = {
  args: { orders: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '아직 결제 내역이 없어요' })).toBeVisible()
  },
}

export const Loading: Story = {
  args: { orders: [], loading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('불러오는 중')
  },
}

export const ErrorWithRetry: Story = {
  args: { orders: [], error: true, onRetry: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('연결을 확인하고')
    await userEvent.click(canvas.getByRole('button', { name: '다시 불러오기' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

export const English: Story = {
  args: { labels: undefined, locale: 'en-US' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list', { name: 'Payments' })).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: /^Details: / })).toHaveLength(3)
    await expect(canvas.getAllByText('Hyundai Card ····1234')[0]).toBeVisible()
  },
}

/** 320px · 375px — 가로 스크롤 없이 줄이 접힌다 */
function NoSidewaysScroll({ width }: { width: string }) {
  return (
    <div data-testid="frame" style={{ width }}>
      <OrderList
        orders={orders.map((o) => ({ ...o, orderName: '아주 긴 이름의 응원하기 항목 '.repeat(3) }))}
        onOpen={() => undefined}
        labels={koPaymentLabels}
        locale="ko-KR"
        formatTime={() => '2026. 1. 1. 오후 12:00'}
      />
    </div>
  )
}

export const At320: Story = {
  render: () => <NoSidewaysScroll width="20rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}

export const At375: Story = {
  render: () => <NoSidewaysScroll width="23.4375rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}
