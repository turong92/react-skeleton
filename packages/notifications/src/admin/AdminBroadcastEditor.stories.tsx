import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { WithQuery } from '../stories/WithQuery'
import { AdminBroadcastEditor } from './AdminBroadcastEditor'
import { koBroadcastAdminLabels } from './labels.ko'
import { createFakeBroadcastAdmin } from './stories/fakeBroadcastAdmin'

/**
 * 공지 쓰기 - 종류(광고면 안내) · 제목 · 본문 · 링크 · 대상(+ 대상 수) · 채널(알림함은 항상, 푸시 불가 종류면 푸시 칸 잠김) · 즉시/예약 ·
 * 「나에게 테스트」 · 「보내기」. **보내기는 확인 창(대상 수 · 채널 · 시각)에서 확인해야만 나간다.**
 * 역할은 `roleChoices`, 워크스페이스는 `workspaceChoices` 로 고르고 없으면 직접 적는다. `notification-broadcast.send` 가 없으면 쓰는 화면이 없다.
 */
const meta = {
  title: 'Packages/notifications/admin/AdminBroadcastEditor',
  component: AdminBroadcastEditor,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeBroadcastAdmin().api,
    onSent: fn(),
    onSaved: fn(),
    onCancel: fn(),
    labels: koBroadcastAdminLabels,
    locale: 'ko-KR',
    typeLabels: {
      'notice.service': '서비스 공지',
      'notice.policy': '정책 안내',
      'promo.notes-tips': '팁 소식 (광고)',
    },
    roleChoices: [
      { value: 'USER', label: '일반 사용자' },
      { value: 'ADMIN', label: '운영자' },
    ],
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof AdminBroadcastEditor>
export default meta
type Story = StoryObj<typeof meta>

export const SendNeedsConfirmation: Story = {
  render: (args) => {
    const fake = createFakeBroadcastAdmin()
    ;(globalThis as { __fakeCalls?: string[] }).__fakeCalls = fake.calls
    return <AdminBroadcastEditor {...args} api={fake.api} />
  },
  play: async ({ canvas, userEvent, args }) => {
    const calls = (globalThis as { __fakeCalls?: string[] }).__fakeCalls ?? []
    await userEvent.type(await canvas.findByLabelText(/^제목/), '정기 점검 안내')
    await userEvent.click(canvas.getByRole('checkbox', { name: /푸시/ }))
    await expect(await canvas.findByText('대상 3명')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '보내기' }))
    // 확인 창이 떠 있을 뿐, 아직 아무것도 만들지도 보내지도 않았다
    const dialog = within(await screen.findByRole('dialog', { name: '이 공지를 보낼까요?' }))
    await expect(dialog.getByText(/알림함 \(항상\), 푸시/)).toBeVisible()
    await expect(calls).toEqual([])
    await expect(args.onSent).not.toHaveBeenCalled()
    await userEvent.click(await dialog.findByRole('button', { name: '3명에게 보내기' }))
    await waitFor(() => expect(args.onSent).toHaveBeenCalled())
    await expect(calls.map((c) => c.split(':')[0])).toEqual(['create', 'send'])
  },
}

export const DismissingTheConfirmationSendsNothing: Story = {
  render: (args) => {
    const fake = createFakeBroadcastAdmin()
    ;(globalThis as { __fakeCalls?: string[] }).__fakeCalls = fake.calls
    return <AdminBroadcastEditor {...args} api={fake.api} />
  },
  play: async ({ canvas, userEvent, args }) => {
    const calls = (globalThis as { __fakeCalls?: string[] }).__fakeCalls ?? []
    await userEvent.type(await canvas.findByLabelText(/^제목/), '보내지 않을 공지')
    await userEvent.click(canvas.getByRole('button', { name: '보내기' }))
    const dialog = within(await screen.findByRole('dialog', { name: '이 공지를 보낼까요?' }))
    await userEvent.click(dialog.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(calls).toEqual([])
    await expect(args.onSent).not.toHaveBeenCalled()
  },
}

export const PushLockedForTypesThatCannotPush: Story = {
  render: (args) => <AdminBroadcastEditor {...args} api={createFakeBroadcastAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    const push = await canvas.findByRole('checkbox', { name: /푸시/ })
    await expect(push).toBeEnabled()
    await userEvent.selectOptions(canvas.getByLabelText(/^종류/), '정책 안내')
    await expect(canvas.getByRole('checkbox', { name: /푸시/ })).toBeDisabled()
    await expect(canvas.getByRole('checkbox', { name: /푸시/ })).not.toBeChecked()
    await expect(canvas.getByText('이 종류는 푸시로 보내지 않아요.')).toBeVisible()
    // 알림함은 늘 켜져 있고 못 끈다
    await expect(canvas.getByRole('checkbox', { name: /알림함/ })).toBeChecked()
    await expect(canvas.getByRole('checkbox', { name: /알림함/ })).toBeDisabled()
  },
}

export const AdvertisingTypeWarnsAboutConsentAndNight: Story = {
  render: (args) => <AdminBroadcastEditor {...args} api={createFakeBroadcastAdmin().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(await canvas.findByLabelText(/^종류/), '팁 소식 (광고)')
    await expect(canvas.getByText(/광고 수신에 동의한 사람에게만/)).toBeVisible()
    await userEvent.selectOptions(canvas.getByLabelText('보내는 때'), '예약')
    const at = canvas.getByLabelText(/^보낼 시각/)
    await userEvent.type(at, '2099-01-15T23:30')
    await expect(canvas.getByText(/밤 시간대예요/)).toBeVisible()
    await userEvent.clear(at)
    await userEvent.type(at, '2099-01-15T13:30')
    await expect(canvas.queryByText(/밤 시간대예요/)).toBeNull()
  },
}

export const TestSendSavesADraftOnce: Story = {
  render: (args) => {
    const fake = createFakeBroadcastAdmin()
    ;(globalThis as { __fakeCalls?: string[] }).__fakeCalls = fake.calls
    return <AdminBroadcastEditor {...args} api={fake.api} />
  },
  play: async ({ canvas, userEvent }) => {
    const calls = (globalThis as { __fakeCalls?: string[] }).__fakeCalls ?? []
    await userEvent.type(await canvas.findByLabelText(/^제목/), '테스트할 공지')
    await userEvent.click(canvas.getByRole('button', { name: '나에게 테스트' }))
    await expect(await canvas.findByText(/\[테스트\]를 붙여 나에게 보냈어요/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '나에게 테스트' }))
    await waitFor(() => expect(calls.filter((c) => c.startsWith('test:'))).toHaveLength(2))
    // 두 번째 테스트는 새 초안을 또 만들지 않고 같은 초안을 고친다
    await expect(calls.filter((c) => c === 'create')).toHaveLength(1)
  },
}

export const EditsAnExistingDraft: Story = {
  render: (args) => (
    <AdminBroadcastEditor {...args} id="bc_draft" api={createFakeBroadcastAdmin().api} />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByLabelText(/^제목/)).toHaveValue('작성 중인 공지')
  },
}

export const OnlyDraftsAreEditable: Story = {
  render: (args) => (
    <AdminBroadcastEditor {...args} id="bc_sent" api={createFakeBroadcastAdmin().api} />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/임시 저장한 공지만 고칠 수 있어요/)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '보내기' })).toBeNull()
  },
}

export const NoWritingWithoutPermission: Story = {
  render: (args) => (
    <AdminBroadcastEditor {...args} api={createFakeBroadcastAdmin().api} can={() => false} />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('공지를 쓸 권한이 없어요.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '보내기' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: '나에게 테스트' })).toBeNull()
  },
}
