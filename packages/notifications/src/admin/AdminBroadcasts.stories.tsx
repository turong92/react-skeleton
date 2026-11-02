import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { WithQuery } from '../stories/WithQuery'
import { AdminBroadcasts } from './AdminBroadcasts'
import { koBroadcastAdminLabels } from './labels.ko'
import { createFakeBroadcastAdmin } from './stories/fakeBroadcastAdmin'

/**
 * 공지 목록 - 상태 칩 · 종류 · 대상 · 시각 · 진행 막대, 상태로 거르기, 「새 공지」(`notification-broadcast.send` 가 있을 때만).
 * 패키지는 라우터를 모른다 - 「새 공지」 와 줄의 「열기」 는 콜백으로 앱이 잇는다. 모듈의 `admin.enabled` 가 꺼진 서버(404)는 안내만.
 */
const meta = {
  title: 'Packages/notifications/admin/AdminBroadcasts',
  component: AdminBroadcasts,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeBroadcastAdmin().api,
    onCreate: fn(),
    onOpen: fn(),
    labels: koBroadcastAdminLabels,
    locale: 'ko-KR',
    typeLabels: { 'notice.service': '서비스 공지', 'promo.notes-tips': '팁 소식 (광고)' },
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminBroadcasts>
export default meta
type Story = StoryObj<typeof meta>

export const Several: Story = {
  render: (args) => <AdminBroadcasts {...args} api={createFakeBroadcastAdmin().api} />,
  play: async ({ canvas, userEvent, args }) => {
    const table = within(await canvas.findByRole('table', { name: '공지 목록' }))
    await expect(table.getByText('정기 점검 안내')).toBeVisible()
    // 보냄 · 보내는 중 · 중간에 멈춤 · 취소됨 - 임시 저장과 예약은 진행 막대가 없다
    await expect(table.getAllByRole('progressbar', { name: '지금까지 보낸 사람' })).toHaveLength(4)
    await userEvent.click(table.getByRole('button', { name: '열기: 새 기능 소개' }))
    await expect(args.onOpen).toHaveBeenCalledWith('bc_sending')
    await userEvent.click(canvas.getByRole('button', { name: '새 공지' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

export const FilterByStatus: Story = {
  render: (args) => <AdminBroadcasts {...args} api={createFakeBroadcastAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('정기 점검 안내')
    await userEvent.selectOptions(canvas.getByLabelText('상태'), '예약됨')
    await expect(await canvas.findByText('연말 이용 안내')).toBeVisible()
    await expect(canvas.queryByText('정기 점검 안내')).toBeNull()
  },
}

export const Empty: Story = {
  render: (args) => <AdminBroadcasts {...args} api={createFakeBroadcastAdmin([]).api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('아직 공지가 없어요.')).toBeVisible()
  },
}

export const NoCreateButtonWithoutPermission: Story = {
  render: (args) => (
    <AdminBroadcasts {...args} api={createFakeBroadcastAdmin().api} can={() => false} />
  ),
  play: async ({ canvas }) => {
    await canvas.findByRole('table')
    await expect(canvas.queryByRole('button', { name: '새 공지' })).toBeNull()
  },
}
