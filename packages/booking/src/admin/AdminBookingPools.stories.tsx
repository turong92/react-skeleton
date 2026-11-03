import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { WithQuery } from '../stories/WithQuery'
import { AdminBookingPools } from './AdminBookingPools'
import { createFakeBookingAdmin } from './fakeAdmin'
import { koBookingAdminLabels } from './labels'

/**
 * 예약 운영 - 풀 고르기 · 현황(5초 갱신) · 판매 멈춤 / 다시 · 닫기(확인 창) · 「구역 · 열 범위 · 번호 범위 · 등급 · 가격」으로 자리 넣기 · 배치도에서 골라 막기 / 풀기 · 풀 만들기.
 * 권한 검사는 서버(`booking.manage` · `booking.read`)가 하고, 화면을 숨기는 일은 앱의 라우트가 한다.
 */
const meta = {
  title: 'Packages/booking/admin/AdminBookingPools',
  component: AdminBookingPools,
  parameters: { layout: 'padded' },
  args: {
    labels: koBookingAdminLabels,
    api: createFakeBookingAdmin().admin,
    bookingApi: createFakeBookingAdmin().user,
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminBookingPools>
export default meta
type Story = StoryObj<typeof meta>

export const AddsSeatsFromARangeAndBlocksOne: Story = {
  render: () => {
    const f = createFakeBookingAdmin()
    return <AdminBookingPools api={f.admin} bookingApi={f.user} labels={koBookingAdminLabels} />
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('판매 중', { selector: 'span' })).toBeVisible()
    await userEvent.type(canvas.getByLabelText('구역'), 'A')
    await userEvent.type(canvas.getByLabelText('열'), 'A-B')
    await userEvent.type(canvas.getByLabelText('번호'), '1-3')
    await userEvent.type(canvas.getByLabelText('등급'), 'R')
    await userEvent.click(canvas.getByRole('button', { name: '자리 넣기' }))
    await expect(await canvas.findByText('자리 6개를 넣었어요.')).toBeVisible()
    await userEvent.click(
      await canvas.findByRole('button', { name: /A구역 A열 1번 R석, 선택 가능/ }),
    )
    await userEvent.click(canvas.getByRole('button', { name: '고른 자리 막기' }))
    await expect(await canvas.findByText('자리 1개를 바꿨어요.')).toBeVisible()
  },
}

export const RejectsABadRangeBeforeSending: Story = {
  render: () => {
    const f = createFakeBookingAdmin()
    return <AdminBookingPools api={f.admin} bookingApi={f.user} labels={koBookingAdminLabels} />
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('구역'), 'A')
    await userEvent.type(canvas.getByLabelText('열'), 'C-A')
    await userEvent.type(canvas.getByLabelText('번호'), '1-3')
    await userEvent.type(canvas.getByLabelText('등급'), 'R')
    await userEvent.click(canvas.getByRole('button', { name: '자리 넣기' }))
    await expect(await canvas.findByText('열은 A, A-C, 3, 1-5 꼴로 적어요.')).toBeVisible()
  },
}

export const PausesTheSales: Story = {
  render: () => {
    const f = createFakeBookingAdmin()
    return <AdminBookingPools api={f.admin} bookingApi={f.user} labels={koBookingAdminLabels} />
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '판매 멈춤' }))
    await expect(await canvas.findByRole('button', { name: '판매 다시 시작' })).toBeVisible()
  },
}
