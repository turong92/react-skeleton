import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { BookingDemo } from './stories/BookingDemo'

/**
 * 좌석 예약 한 벌 - 배치도 + 내 보류. 진짜 SSE 클라이언트가 (가짜) 흐름을 읽는다: 열리면 스냅샷을 읽고, 다른 사람의 사건은 새로고침 없이 반영된다.
 * 누르면 잡기 · 다시 누르면 놓기 · 남이 잡은 자리는 바로 선택 불가 · 「결제하기」 뒤에는 자리가 고정되고 「나가기」만 열려 있다.
 */
const meta = {
  title: 'Packages/booking/SeatBooking',
  component: BookingDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BookingDemo>
export default meta
type Story = StoryObj<typeof meta>

export const PickLetGoAndSeeOthersTakeSeats: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: /A구역 1열 1번 R석.*선택 가능/ }),
    )
    await expect(
      await canvas.findByRole('button', { name: /A구역 1열 1번 R석.*내 자리/ }),
    ).toBeVisible()
    await expect(canvas.getByText(/₩50,000/, { selector: 'strong' })).toBeVisible()
    // 다른 분이 잡은 자리가 새로고침 없이 선택 불가로 바뀐다
    await userEvent.click(canvas.getByRole('button', { name: '다른 분이 A3 를 잡았다' }))
    await expect(
      await canvas.findByRole('button', { name: /A구역 1열 3번 R석.*선택 불가/ }),
    ).toBeDisabled()
    // 다시 누르면 놓는다
    await userEvent.click(canvas.getByRole('button', { name: /A구역 1열 1번 R석.*내 자리/ }))
    await expect(
      await canvas.findByRole('button', { name: /A구역 1열 1번 R석.*선택 가능/ }),
    ).toBeEnabled()
  },
}

export const SomeoneElseTookTheSeatJustBeforeMe: Story = {
  play: async ({ canvas, userEvent }) => {
    const seat = await canvas.findByRole('button', { name: /A구역 1열 1번 R석.*선택 가능/ })
    // 사건이 내 화면에 닿기 전에 눌렀다고 가정: 서버는 이미 남의 자리
    await userEvent.click(canvas.getByRole('button', { name: '다른 분이 A1 을 잡았다' }))
    await userEvent.click(seat)
    await expect(
      await canvas.findByRole('button', { name: /A구역 1열 1번 R석.*선택 불가/ }),
    ).toBeDisabled()
  },
}

export const CheckoutFixesTheSeatsAndLeavingFreesThem: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: /A구역 1열 2번 R석.*선택 가능/ }),
    )
    await userEvent.click(await canvas.findByRole('button', { name: '결제하기' }))
    await expect(await canvas.findByText('결제창 자리 50000')).toBeVisible()
    for (const button of canvas.getAllByRole('button', { name: /구역 1열/ }))
      await expect(button).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: '나가기' }))
    await expect(
      await canvas.findByRole('button', { name: /A구역 1열 2번 R석.*선택 가능/ }),
    ).toBeEnabled()
    await expect(canvas.queryByText('결제창 자리 50000')).toBeNull()
  },
}
