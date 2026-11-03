import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koBookingLabels } from './labels'
import { SeatMap } from './SeatMap'
import type { Seat } from './types'

const seat = (id: string, over: Partial<Seat> = {}): Seat => ({
  id,
  section: 'A',
  row: '1',
  number: Number(id.slice(1)),
  grade: 'R',
  price: 50_000,
  state: 'OPEN',
  v: 1,
  ...over,
})

/**
 * 좌석 배치도 - 구역 → 열 → 번호 격자. 세 상태: 선택 가능 · 내 자리 · 선택 불가(색만이 아니라 단추 이름과 줄 그은 글자로도).
 * 누르면 `onPick`(잡기인지 놓기인지는 보류 컨트롤러가 정한다), 응답을 기다리는 자리만 잠기고, 연결이 끊긴 동안은 위에 「다시 연결하는 중」.
 */
const meta = {
  title: 'Packages/booking/SeatMap',
  component: SeatMap,
  parameters: { layout: 'padded' },
  args: {
    labels: koBookingLabels,
    currency: 'KRW',
    locale: 'ko-KR',
    onPick: fn(),
    seats: [
      seat('A1'),
      seat('A2', { state: 'TAKEN', heldUntil: '2999-01-01T00:00:00Z' }),
      seat('A3'),
      seat('B1', { section: 'B', grade: 'S', price: 30_000 }),
    ],
  },
} satisfies Meta<typeof SeatMap>
export default meta
type Story = StoryObj<typeof meta>

export const ThreeStates: Story = {
  args: { mineIds: ['A3'] },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('button', { name: /A구역 1열 1번 R석.*선택 가능/ })).toBeEnabled()
    await expect(
      canvas.getByRole('button', { name: /A구역 1열 3번 R석.*내 자리/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      canvas.getByRole('button', { name: /A구역 1열 2번 R석.*선택 불가/ }),
    ).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: /A구역 1열 1번/ }))
    await expect(args.onPick).toHaveBeenCalledWith('A1')
  },
}

export const OnlyThePendingSeatIsLocked: Story = {
  args: { pendingIds: ['A1'] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /A구역 1열 1번/ })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: /A구역 1열 3번/ })).toBeEnabled()
  },
}

export const LockedWholeMap: Story = {
  args: { disabled: true, mineIds: ['A3'] },
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).toBeDisabled()
  },
}

export const ShowsReconnecting: Story = {
  args: { connection: 'reconnecting' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/다시 연결하는 중이에요/)).toBeVisible()
  },
}

export const LoadingAndEmpty: Story = {
  args: { loaded: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('배치도를 불러오는 중이에요…')).toBeVisible()
  },
}
