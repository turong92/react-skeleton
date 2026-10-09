import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { webhookEvent } from '../test/fixtures'
import { WebhookEventTable } from './WebhookEventTable'

/**
 * 웹훅 수신함 — 결제사가 보낸 것을 받은 사실과 처리 결과(본문은 없다). 이벤트 이름 · 결제사 결제 번호 · 우리 이유 코드는 점검용이라 코드 모양으로 그대로,
 * 상태는 글자(처리됨 · 건너뜀 · 처리 안 됨 · 처리 못 함). **손이 필요한 줄**(처리 안 됨 · 처리 못 함, 받은 지 10분 넘은 받음)에만 테두리 단추 「다시 처리」(이름에 이벤트 이름과 줄을 가르는 번호가 붙는다) -
 * 서버는 누를 때마다 작업 하나(결제사 조회 하나)를 넣으니, 건너뜀 · 처리됨 · 갓 받은 줄에 단추를 두면 연타를 부른다. 보낸 줄은 응답이 올 때까지 일하는 중, 성공하면 「다시 넣었어요」 상태 글자.
 * 표식 줄(한 결제의 알림이 너무 많이 와서 서버가 만든 줄)은 이벤트 이름 자리에 한 문장(기다리는 중 · 확인이 끝남).
 */
const now = Date.parse('2026-01-01T03:02:00Z') // 고정한 지금 - 아래 줄들은 2분 전에 받았다
const events = [
  webhookEvent({ id: 1, status: 'PROCESSED' }),
  webhookEvent({ id: 2, status: 'FAILED', lastError: 'LOOKUP_UNAVAILABLE', deliveries: 3 }),
  webhookEvent({ id: 3, status: 'DEAD', lastError: 'MODE_MISMATCH', orderId: null }),
  webhookEvent({ id: 4, status: 'IGNORED', resourceId: 'tgen_other', orderId: null }),
  webhookEvent({ id: 5, status: 'RECEIVED', orderId: 'ord_5' }),
]

const meta = {
  title: 'Packages/payment/admin/WebhookEventTable',
  component: WebhookEventTable,
  args: {
    events,
    onRetryEvent: fn(),
    now,
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 1. 1. 오후 12:00',
  },
} satisfies Meta<typeof WebhookEventTable>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: '웹훅 수신함' })
    await expect(within(table).getAllByRole('row')).toHaveLength(6)
    for (const status of ['처리됨', '처리 안 됨', '처리 못 함', '건너뜀', '받음'])
      await expect(within(table).getByText(status)).toBeVisible()
    await expect(within(table).getByText('LOOKUP_UNAVAILABLE')).toBeVisible()
    await expect(within(table).getByText('3')).toBeVisible()
  },
}

export const RetryOnlyWhereAHandIsNeeded: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const buttons = canvas.getAllByRole('button', { name: /^다시 처리: / })
    await expect(buttons).toHaveLength(2) // 처리 안 됨 · 처리 못 함 - 처리됨 · 건너뜀 · 갓 받은 줄에는 없다
    // 같은 이벤트 이름이어도 줄마다 이름이 다르다 - 결제 번호, 없으면 결제사 결제 번호가 붙는다
    await expect(buttons[0]).toHaveAccessibleName('다시 처리: PAYMENT_STATUS_CHANGED (ord_1)')
    await expect(buttons[1]).toHaveAccessibleName('다시 처리: PAYMENT_STATUS_CHANGED (tgen_9f8e7d)')
    await expect(buttons[0]).toHaveAttribute('data-variant', 'secondary')
    await expect(getComputedStyle(buttons[0]).borderTopWidth).not.toBe('0px')
    await userEvent.click(buttons[1])
    await expect(args.onRetryEvent).toHaveBeenCalledWith(events[2])
  },
}

/** 받은 지 10분 넘게 「받음」인 채 남은 줄 - 작업이 죽었을 수 있어서 단추가 있다. 갓 받은 줄에는 없다(이미 작업이 걸려 있다) */
export const StaleReceivedRow: Story = {
  args: {
    events: [
      webhookEvent({
        id: 5,
        status: 'RECEIVED',
        orderId: 'ord_5',
        receivedAt: '2026-01-01T02:40:00Z',
      }),
      webhookEvent({ id: 6, status: 'RECEIVED', orderId: 'ord_6' }),
    ],
  },
  play: async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button', { name: /^다시 처리: / })
    await expect(buttons).toHaveLength(1)
    await expect(buttons[0]).toHaveAccessibleName('다시 처리: PAYMENT_STATUS_CHANGED (ord_5)')
  },
}

/** 다시 넣은 줄 - 단추 자리에 「다시 넣었어요」 상태 글자가 남고, 다른 줄의 단추는 그대로다. 부모는 누른 시각만 더하면 된다 - 목록이 다시 읽혀도 비우지 않는다 */
export const RetriedRow: Story = {
  args: { retried: { 2: now - 60_000 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('다시 넣었어요')
    const buttons = canvas.getAllByRole('button', { name: /^다시 처리: / })
    await expect(buttons).toHaveLength(1)
    await expect(buttons[0]).toHaveAccessibleName('다시 처리: PAYMENT_STATUS_CHANGED (tgen_9f8e7d)')
  },
}

/**
 * 다시 넣은 줄은 `RECEIVED` 가 되지만 받은 시각은 그대로다 - 목록을 다시 읽은 모양이다(옛 `receivedAt` 의 `RECEIVED`).
 * 누른 지 `staleReceivedAfterMs` 가 안 지났으면 단추가 다시 나오지 않고, 지났으면 돌아온다(작업이 죽었을 수 있다)
 */
export const ARetriedRowStaysQuietEvenWhenItsReceivedTimeIsOld: Story = {
  args: {
    events: [
      webhookEvent({
        id: 5,
        status: 'RECEIVED',
        orderId: 'ord_5',
        receivedAt: '2026-01-01T02:00:00Z',
      }),
      webhookEvent({
        id: 6,
        status: 'RECEIVED',
        orderId: 'ord_6',
        receivedAt: '2026-01-01T02:00:00Z',
      }),
    ],
    retried: { 5: now - 2 * 60_000, 6: now - 11 * 60_000 },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')).toHaveLength(1)
    await expect(canvas.getByRole('status')).toHaveTextContent('다시 넣었어요')
    const buttons = canvas.getAllByRole('button', { name: /^다시 처리: / })
    await expect(buttons).toHaveLength(1)
    await expect(buttons[0]).toHaveAccessibleName('다시 처리: PAYMENT_STATUS_CHANGED (ord_6)')
  },
}

/** 수신함의 「결제사 결제 번호」는 우리 주문의 결제 키다 - 키가 아직 없는 주문(`order:<주문 id>`)은 코드가 아니라 「결제사 결제 번호 없음」으로 읽힌다 */
export const AnOrderWithoutAPaymentKey: Story = {
  args: {
    events: [
      webhookEvent({ id: 1, status: 'IGNORED', resourceId: 'order:ord_5', orderId: 'ord_5' }),
      webhookEvent({ id: 2, status: 'IGNORED' }),
    ],
  },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: '웹훅 수신함' })
    await expect(within(table).getByText('결제사 결제 번호 없음 (결제 ord_5)')).toBeVisible()
    await expect(within(table).queryByText('order:ord_5')).toBeNull()
    await expect(within(table).getByText('tgen_9f8e7d')).toBeVisible()
  },
}

/** 표식 줄 - 코드(`LIMIT_REACHED`)가 아니라 일어난 일을 말한다. 기다리는 중(받음)과 확인이 끝남(건너뜀 · 처리됨)은 문장이 다르고, 끝난 줄과 갓 받은 줄에는 단추가 없다. 받은 횟수는 상한에 걸린 신호의 수 */
export const LimitMarkerRow: Story = {
  args: {
    events: [
      webhookEvent({
        id: 9,
        resourceType: 'LIMIT_MARKER',
        eventType: 'LIMIT_REACHED',
        status: 'IGNORED',
        deliveries: 41,
      }),
      webhookEvent({
        id: 10,
        resourceType: 'LIMIT_MARKER',
        eventType: 'LIMIT_REACHED',
        status: 'RECEIVED',
        deliveries: 7,
      }),
    ],
  },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: '웹훅 수신함' })
    await expect(
      within(table).getByText('이 결제의 알림이 너무 많이 와서, 한 번에 확인했어요'),
    ).toBeVisible()
    await expect(
      within(table).getByText('이 결제의 알림이 너무 많이 와서, 잠시 뒤 한 번에 확인해요'),
    ).toBeVisible()
    await expect(within(table).queryByText('LIMIT_REACHED')).toBeNull()
    await expect(within(table).getByText('41')).toBeVisible()
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
  },
}

/** 표식 줄의 확인이 안 됐을 때 - `FAILED` 는 작업이 다시 하고 있다고, 시도를 다 쓴 `DEAD` 만 손이 필요하다고 말한다. 두 줄 모두 「다시 처리」 단추가 있다 */
export const LimitMarkerNotChecked: Story = {
  args: {
    events: [
      webhookEvent({
        id: 11,
        resourceType: 'LIMIT_MARKER',
        eventType: 'LIMIT_REACHED',
        status: 'FAILED',
        deliveries: 41,
      }),
      webhookEvent({
        id: 12,
        resourceType: 'LIMIT_MARKER',
        eventType: 'LIMIT_REACHED',
        status: 'DEAD',
        deliveries: 12,
      }),
    ],
  },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: '웹훅 수신함' })
    await expect(within(table).getByText(/확인하지 못해 다시 시도하고 있어요/)).toBeVisible()
    await expect(within(table).getByText(/확인하지 못했어요\. 다시 처리해 주세요/)).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: /다시 처리/ })).toHaveLength(2)
  },
}

export const RetryingOneRow: Story = {
  args: { retryingId: 2 },
  play: async ({ canvas }) => {
    const busy = canvas.getByRole('button', { name: /다시 시도하는 중/ })
    await expect(busy).toBeDisabled() // 정말 일하는 중일 때만 disabled
    await expect(canvas.getAllByRole('button')).toHaveLength(2) // 보내는 줄 + 손이 필요한 다른 한 줄
    await expect(canvas.queryByText('Loading')).toBeNull()
  },
}

export const ReadOnly: Story = {
  args: { onRetryEvent: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
  },
}

export const Empty: Story = {
  args: { events: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '받은 웹훅이 없어요' })).toBeVisible()
  },
}

export const Loading: Story = {
  args: { events: [], loading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('불러오는 중')
  },
}

export const ErrorKeepsTheRows: Story = {
  args: { error: true, onRetry: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(within(canvas.getByRole('table')).getAllByRole('row')).toHaveLength(6)
    await userEvent.click(canvas.getByRole('button', { name: '다시 불러오기' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

export const English: Story = {
  args: { labels: undefined, locale: 'en-US' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Webhook inbox' })).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: /^Process again: / })).toHaveLength(2)
  },
}
