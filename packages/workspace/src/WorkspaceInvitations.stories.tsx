import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { InvitationsDemo } from './stories/Demos'

/**
 * 사람 초대하기 — 주소를 여러 개(쉼표 · 공백 · 줄바꿈, 한 번에 20개) 적어 보내고, 기다리는 초대 표에서 다시 보내기 · 취소.
 * 결과는 주소마다 보냄 · 이미 기다리는 초대 · 좌석 모자람으로 나뉘어 보인다. 좌석 상한이 있으면 `n / 상한`(멤버 + 기다리는 초대).
 * 소유자는 관리자로도, 관리자는 멤버로만 초대하고, 멤버에게는 안내 한 줄뿐이다
 */
const meta = {
  title: 'Packages/workspace/WorkspaceInvitations',
  component: InvitationsDemo,
  parameters: { layout: 'padded' },
  args: { role: 'OWNER' },
} satisfies Meta<typeof InvitationsDemo>
export default meta
type Story = StoryObj<typeof meta>

const emails = (canvas: ReturnType<typeof within>) => canvas.findByLabelText(/이메일 주소/)

export const OwnerSeesTheFormAndThePendingTable: Story = {
  play: async ({ canvas }) => {
    await expect(await emails(canvas)).toBeVisible()
    await expect(canvas.getByRole('combobox', { name: '역할' })).toBeVisible()
    await expect(await canvas.findByText('live@example.com')).toBeVisible()
    // 만료된 초대는 표시된다
    await expect(canvas.getByText('만료됨')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'live@example.com에게 초대 다시 보내기' }),
    ).toBeVisible()
    await expect(document.body.innerHTML).not.toContain('acc_')
  },
}

export const InvitingSeveralAddressesAtOnce: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      await emails(canvas),
      'Ann@example.com, bo@example.com{enter}ann@example.com',
    )
    await userEvent.click(canvas.getByRole('button', { name: '초대 보내기' }))
    // 대소문자 · 중복은 하나로 합쳐 두 명
    await expect(await canvas.findByText('2명에게 초대를 보냈어요')).toBeVisible()
    await expect(await canvas.findByText('ann@example.com')).toBeVisible()
    await expect(canvas.getByText('bo@example.com')).toBeVisible()
    await expect(await emails(canvas)).toHaveValue('')
  },
}

export const AMalformedAddressIsNamedOnTheField: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await emails(canvas), 'ok@example.com nope')
    await userEvent.click(canvas.getByRole('button', { name: '초대 보내기' }))
    await expect(await canvas.findByText('이메일 주소 모양이 아니에요: nope')).toBeVisible()
    await expect(canvas.queryByText(/명에게 초대를 보냈어요/)).toBeNull()
  },
}

export const MoreThanTwentyAtOnceIsRefused: Story = {
  play: async ({ canvas, userEvent }) => {
    const list = Array.from({ length: 21 }, (_, i) => `u${i}@example.com`).join(' ')
    const field = await emails(canvas)
    await userEvent.click(field)
    await userEvent.paste(list)
    await userEvent.click(canvas.getByRole('button', { name: '초대 보내기' }))
    await expect(await canvas.findByText('한 번에 20명까지 초대할 수 있어요.')).toBeVisible()
  },
}

export const AnAddressAlreadyWaitingIsSkippedAndSaysSo: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await emails(canvas), 'live@example.com')
    await userEvent.click(canvas.getByRole('button', { name: '초대 보내기' }))
    await expect(await canvas.findByText(/1개 주소는 이미 기다리는 초대가 있어요/)).toBeVisible()
  },
}

export const SeatsAreShownAndTheRestStayInTheField: Story = {
  // 멤버 5 + 기다리는 초대 1 = 6 / 8 → 두 자리가 남는다
  args: { seatLimit: 8 },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('좌석 6 / 8')).toBeVisible()
    await userEvent.type(await emails(canvas), 'a@example.com b@example.com c@example.com')
    await userEvent.click(canvas.getByRole('button', { name: '초대 보내기' }))
    await expect(await canvas.findByText('2명에게 초대를 보냈어요')).toBeVisible()
    await expect(
      canvas.getByText(/1개 주소는 좌석이 모자라 초대하지 못했어요: c@example.com/),
    ).toBeVisible()
    // 자리를 만든 뒤 바로 다시 보낼 수 있게 못 보낸 주소만 칸에 남는다
    await expect(await emails(canvas)).toHaveValue('c@example.com')
    await expect(await canvas.findByText('좌석 8 / 8')).toBeVisible()
  },
}

export const AnAddressThatIsAlreadyAMemberIsToldSo: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await emails(canvas), 'existing@example.com new@example.com')
    await userEvent.click(canvas.getByRole('button', { name: '초대 보내기' }))
    await expect(await canvas.findByText('1명에게 초대를 보냈어요')).toBeVisible()
    await expect(canvas.getByText('1개 주소는 이미 멤버예요: existing@example.com')).toBeVisible()
  },
}

export const AFullWorkspaceCannotSend: Story = {
  args: { seatLimit: 6 },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('좌석 6 / 6')).toBeVisible()
    await expect(canvas.getByText(/좌석이 다 찼어요/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '초대 보내기' })).toBeDisabled()
  },
}

export const ResendingTwiceInARowIsTooSoon: Story = {
  play: async ({ canvas, userEvent }) => {
    const resend = await canvas.findByRole('button', {
      name: 'live@example.com에게 초대 다시 보내기',
    })
    await userEvent.click(resend)
    await expect(
      await canvas.findByText('live@example.com에게 다시 보냈어요. 이전 링크는 이제 쓸 수 없어요.'),
    ).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'live@example.com에게 초대 다시 보내기' }),
    )
    await expect(
      await canvas.findByText('방금 보냈어요. 42초 뒤에 다시 보낼 수 있어요.'),
    ).toBeVisible()
  },
}

export const RevokingAsksFirstThenRemovesTheRow: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'old@example.com에게 보낸 초대 취소' }),
    )
    const dialog = await within(document.body).findByRole('dialog', {
      name: 'old@example.com에게 보낸 초대를 취소할까요?',
    })
    await userEvent.click(within(dialog).getByRole('button', { name: '초대 취소' }))
    await expect(await canvas.findByText('1건')).toBeVisible()
    await expect(canvas.queryByText('old@example.com')).toBeNull()
  },
}

export const AdminInvitesPlainMembersOnly: Story = {
  args: { role: 'ADMIN' },
  play: async ({ canvas }) => {
    await expect(await emails(canvas)).toBeVisible()
    await expect(canvas.queryByRole('combobox')).toBeNull()
  },
}

export const MemberOnlyReadsASentence: Story = {
  args: { role: 'MEMBER' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('소유자와 관리자만 사람을 초대할 수 있어요.'),
    ).toBeVisible()
    await expect(canvas.queryByLabelText(/이메일 주소/)).toBeNull()
    await expect(canvas.queryByRole('button', { name: '초대 보내기' })).toBeNull()
  },
}
