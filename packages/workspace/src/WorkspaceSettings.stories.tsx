import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SettingsDemo } from './stories/Demos'

/**
 * 워크스페이스 설정 — 이름 · 주소 이름(ADMIN 이상), 멤버 표(역할 고르기 · 내보내기 · 소유권 이전), 탈퇴.
 * 단추는 내 역할로 숨는다: 소유자는 모두, 관리자는 멤버 내보내기만, 멤버는 읽기만(+ 탈퇴). 소유자는 먼저 이전해야 나갈 수 있다.
 * 주소 이름을 바꾸면 Provider 가 앱에 새 주소를 알린다(`onCanonicalSlug`) — 옛 주소로 들어온 사람도 같다
 */
const meta = {
  title: 'Packages/workspace/WorkspaceSettings',
  component: SettingsDemo,
  parameters: { layout: 'padded' },
  args: { role: 'OWNER' },
} satisfies Meta<typeof SettingsDemo>
export default meta
type Story = StoryObj<typeof meta>

const log = (canvas: ReturnType<typeof within>) => canvas.getByRole('status', { name: 'log' })

export const OwnerSeesEveryControl: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('combobox', { name: 'Ann의 역할' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Ann 더보기' })).toBeVisible()
    await expect(canvas.queryByRole('combobox', { name: 'Olive의 역할' })).toBeNull()
    await expect(
      canvas.getByText('내가 소유자예요. 나가기 전에 다른 멤버에게 소유권을 이전해 주세요.'),
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '워크스페이스 나가기' })).toBeNull()
    await expect(canvas.getByText('이름 없는 멤버')).toBeVisible()
    await expect(document.body.innerHTML).not.toContain('acc_')
  },
}

export const OwnerChangesARole: Story = {
  play: async ({ canvas, userEvent }) => {
    const select = await canvas.findByRole('combobox', { name: 'Ann의 역할' })
    await expect(select).toHaveValue('MEMBER')
    await userEvent.selectOptions(select, 'ADMIN')
    await expect(await canvas.findByRole('combobox', { name: 'Ann의 역할' })).toHaveValue('ADMIN')
  },
}

export const OwnerRemovesAMemberAfterConfirming: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Bo 더보기' }))
    await userEvent.click(
      await canvas.findByRole('menuitem', { name: '워크스페이스에서 내보내기' }),
    )
    const dialog = await within(document.body).findByRole('dialog', { name: 'Bo님을 내보낼까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
    await expect(await canvas.findByText('4명')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Bo 더보기' })).toBeNull()
  },
}

export const OwnerTransfersOwnership: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Ann 더보기' }))
    await userEvent.click(await canvas.findByRole('menuitem', { name: '소유권 이전' }))
    const dialog = await within(document.body).findByRole('dialog', { name: '소유권 이전' })
    await expect(dialog).toHaveTextContent('Ann님이 Acme의 소유자가 되고, 나는 관리자가 돼요')
    await userEvent.click(within(dialog).getByRole('button', { name: '소유권 이전' }))
    // 이제 내가 관리자 — 소유자 전용 단추가 사라지고 탈퇴 단추가 생긴다
    await expect(await canvas.findByRole('button', { name: '워크스페이스 나가기' })).toBeVisible()
    await expect(canvas.queryByRole('combobox', { name: 'Bo의 역할' })).toBeNull()
  },
}

export const AdminOnlyRemovesPlainMembers: Story = {
  args: { role: 'ADMIN' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Ann 더보기' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Olive 더보기' })).toBeNull()
    await expect(canvas.queryByRole('combobox')).toBeNull()
    await expect(canvas.getByLabelText(/워크스페이스 이름/)).toBeEnabled()
    await expect(canvas.getByRole('button', { name: '워크스페이스 나가기' })).toBeVisible()
  },
}

export const MemberOnlyReads: Story = {
  args: { role: 'MEMBER' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('이름과 주소는 소유자와 관리자만 바꿀 수 있어요.'),
    ).toBeVisible()
    await expect(canvas.queryByLabelText(/워크스페이스 이름/)).toBeNull()
    await expect(canvas.queryByRole('combobox')).toBeNull()
    await expect(canvas.queryByRole('button', { name: /더보기/ })).toBeNull()
    await expect(canvas.getByRole('button', { name: '워크스페이스 나가기' })).toBeVisible()
  },
}

export const MemberLeavesAfterConfirming: Story = {
  args: { role: 'MEMBER' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '워크스페이스 나가기' }))
    const dialog = await within(document.body).findByRole('dialog', { name: 'Acme에서 나갈까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '나가기' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent('left')
  },
}

export const RenamingTheAddressSwapsTheAddress: Story = {
  play: async ({ canvas, userEvent }) => {
    const address = await canvas.findByLabelText(/주소 이름/)
    await userEvent.clear(address)
    await userEvent.type(address, 'acme-inc')
    await userEvent.click(canvas.getByRole('button', { name: '변경 저장' }))
    await expect(await canvas.findByText('저장했어요')).toBeVisible()
    // 저장 직후에도 화면은 비지 않고, Provider 가 앱에 새 주소를 알린다
    await expect(canvas.getByLabelText(/워크스페이스 이름/)).toHaveValue('Acme')
    await expect(log(canvas)).toHaveTextContent('address:acme-inc')
  },
}

export const ATakenAddressIsExplainedOnTheField: Story = {
  play: async ({ canvas, userEvent }) => {
    const address = await canvas.findByLabelText(/주소 이름/)
    await userEvent.clear(address)
    await userEvent.type(address, 'globex')
    await userEvent.click(canvas.getByRole('button', { name: '변경 저장' }))
    await expect(
      await canvas.findByText('이미 쓰고 있는 주소 이름이에요. 다른 이름을 써 주세요.'),
    ).toBeVisible()
  },
}
