import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { FAKE_TOKENS } from './stories/fakeWorkspaces'
import { AcceptDemo } from './stories/Demos'

/**
 * 초대 수락(`/invite`) — 메일 링크의 토큰을 읽어 이 탭 저장소로 옮기고 주소창에서 지운 뒤, 미리보기를 보여 준다.
 * 세 상태: ① 로그인 전 — 「로그인 · 가입 후 수락」 ② 로그인 뒤 — 「초대 수락」 → 그 워크스페이스로 ③ 죽은 초대 · 오류 — 이유별 문장.
 * 로그인 · 가입을 다녀오면 주소에 토큰이 없어도 탭 저장소에서 이어진다
 */
const meta = {
  title: 'Packages/workspace/AcceptInvitation',
  component: AcceptDemo,
  parameters: { layout: 'padded' },
  args: { token: FAKE_TOKENS.ok, signedIn: true },
} satisfies Meta<typeof AcceptDemo>
export default meta
type Story = StoryObj<typeof meta>

const log = (canvas: ReturnType<typeof within>) => canvas.getByRole('status', { name: 'log' })

export const SignedOutSeesThePreviewAndASignInButton: Story = {
  args: { signedIn: false },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Initech에 초대받았어요')).toBeVisible()
    await expect(canvas.getByText('Ivy님이 초대했어요')).toBeVisible()
    await expect(canvas.getByText('이 초대는 m***@example.com 주소로 갔어요.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '초대 수락' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '로그인 · 가입 후 수락' }))
    await expect(log(canvas)).toHaveTextContent('sign-in')
  },
}

export const TheTokenLeavesTheAddressBarButStaysInTheTab: Story = {
  args: { signedIn: false, inAddress: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Initech에 초대받았어요')).toBeVisible()
    // 주소에는 토큰이 남지 않는다
    await expect(log(canvas)).toHaveTextContent('address:/invite')
    await expect(log(canvas)).not.toHaveTextContent('tok-ok')
  },
}

export const SignedInAcceptsAndTheAppGoesToThatWorkspace: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '초대 수락' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent(
      'accepted:initech',
    )
    // 쓴 토큰은 탭에서 지운다
    await expect(log(canvas)).toHaveTextContent('stored:none')
  },
}

export const AnExpiredInvitationSaysSoAndOffersTheStartPage: Story = {
  args: { token: FAKE_TOKENS.expired },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText(/초대가 만료됐어요/)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '초대 수락' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '처음 화면으로' }))
    await expect(log(canvas)).toHaveTextContent('home')
  },
}

export const AUsedInvitationIsToldApartFromAnExpiredOne: Story = {
  args: { token: FAKE_TOKENS.used },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/이미 쓰였거나 취소된 초대예요/)).toBeVisible()
  },
}

export const AnUnknownTokenIsJustInvalid: Story = {
  args: { token: FAKE_TOKENS.unknown },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/유효하지 않은 초대 링크예요/)).toBeVisible()
  },
}

export const NoTokenAnywhereIsInvalidToo: Story = {
  args: { token: null },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/유효하지 않은 초대 링크예요/)).toBeVisible()
  },
}

export const AnotherAccountsEmailIsExplainedAndKeepsTheToken: Story = {
  args: { token: FAKE_TOKENS.mismatch },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '초대 수락' }))
    await expect(
      await canvas.findByText(/m\*\*\*@example.com 주소의 계정으로 로그인해서 수락해 주세요/),
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '초대 수락' })).toBeNull()
  },
}

export const AnUnverifiedEmailAsksToVerifyAndCanTryAgain: Story = {
  args: { token: FAKE_TOKENS.unverified },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '초대 수락' }))
    await expect(await canvas.findByText(/이메일 주소가 아직 확인되지 않았어요/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '초대 수락' })).toBeEnabled()
  },
}

export const AlreadyAMemberIsToldSo: Story = {
  args: { token: FAKE_TOKENS.member },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '초대 수락' }))
    await expect(await canvas.findByText('이미 이 워크스페이스의 멤버예요.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '초대 수락' })).toBeNull()
    // 서버가 알려 준 그 팀으로도 보낸다(수락과 같은 길)
    await expect(canvas.getByRole('status', { name: 'log' })).toHaveTextContent('accepted:acme')
  },
}

export const NoSeatsLeftIsToldSo: Story = {
  args: { token: FAKE_TOKENS.seat },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '초대 수락' }))
    await expect(await canvas.findByText(/남은 좌석이 없어요/)).toBeVisible()
  },
}
