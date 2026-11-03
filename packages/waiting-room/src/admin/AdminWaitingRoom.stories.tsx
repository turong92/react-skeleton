import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { WithQuery } from '../stories/WithQuery'
import { AdminWaitingRoom } from './AdminWaitingRoom'
import { createFakeAdmin } from './fakeAdmin'
import { koWaitingRoomAdminLabels } from './labels'

/**
 * 대기실 운영 - 숫자 현황(5초마다 새로 읽는다) · 분당 입장 수 바꾸기 · 멈춤 / 다시 시작(멈춤 = 분당 0) · 닫기(확인 창, 되돌릴 수 없다).
 * 권한 검사는 서버(`waiting-room.manage`)가 하고, 화면을 숨기는 일은 앱의 라우트가 한다.
 */
const meta = {
  title: 'Packages/waiting-room/admin/AdminWaitingRoom',
  component: AdminWaitingRoom,
  parameters: { layout: 'padded' },
  args: { api: createFakeAdmin().api, roomId: 'wr_1', labels: koWaitingRoomAdminLabels },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminWaitingRoom>
export default meta
type Story = StoryObj<typeof meta>

export const ShowsTheNumbersAndChangesTheSpeed: Story = {
  render: (args) => {
    const fake = createFakeAdmin()
    return <AdminWaitingRoom {...args} api={fake.api} />
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('오픈 전 줄')).toBeVisible()
    await expect(canvas.getByLabelText('분당 입장 수')).toHaveValue('30')
    const input = canvas.getByLabelText('분당 입장 수')
    await userEvent.clear(input)
    await userEvent.type(input, '60')
    await userEvent.click(canvas.getByRole('button', { name: '속도 바꾸기' }))
    // 바꾼 속도로 현황이 다시 읽힌다
    await waitFor(() => expect(canvas.getByText('모두 들어가기까지')).toBeVisible())
    await expect(await canvas.findByText('약 5분')).toBeVisible()
  },
}

export const PausesAndResumes: Story = {
  render: (args) => <AdminWaitingRoom {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '멈추기' }))
    await expect(await canvas.findByText('멈춤')).toBeVisible()
    await expect(await canvas.findByRole('button', { name: '다시 시작' })).toBeVisible()
    await userEvent.type(canvas.getByLabelText('분당 입장 수'), '45')
    await userEvent.click(canvas.getByRole('button', { name: '다시 시작' }))
    await expect(await canvas.findByRole('button', { name: '멈추기' })).toBeVisible()
    await expect(canvas.queryByText('멈춤')).toBeNull()
  },
}

export const RejectsABadSpeed: Story = {
  render: (args) => <AdminWaitingRoom {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByLabelText('분당 입장 수')
    await userEvent.clear(input)
    await userEvent.type(input, '0')
    await expect(await canvas.findByText('1 이상의 정수를 적어 주세요.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '속도 바꾸기' })).toBeDisabled()
  },
}

export const ClosesAfterAConfirmation: Story = {
  render: (args) => <AdminWaitingRoom {...args} api={createFakeAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '대기실 닫기' }))
    const dialog = await within(document.body).findByRole('dialog')
    await expect(within(dialog).getByText('대기실을 닫을까요?')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await expect(await canvas.findByText('대기실을 닫았어요.')).toBeVisible()
    await expect(canvas.queryByLabelText('분당 입장 수')).toBeNull()
  },
}
