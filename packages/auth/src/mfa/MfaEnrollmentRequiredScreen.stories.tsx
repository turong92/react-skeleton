import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent as user, waitFor, within } from 'storybook/test'
import { koAuthLabels } from '../screens/labels.ko'
import { apiError } from '../test/apiFixtures'
import {
  createFakeMfaApi,
  FAKE_MFA_PASSWORD,
  FAKE_RECOVERY_CODES,
  FAKE_TOTP_CODE,
  FAKE_TOTP_SECRET,
} from '../stories/fakeMfaApi'
import { createMfaEnrollmentRequiredController } from './mfaEnrollmentRequired'
import { MfaEnrollmentRequiredGate } from './MfaEnrollmentRequiredGate'
import { MfaEnrollmentRequiredScreen } from './MfaEnrollmentRequiredScreen'

/**
 * 「2단계 인증을 켜 주세요」 - 2단계가 필수(운영자 등)인 계정이 등록 전에 앱 대신 보는 전면 화면(`MfaEnrollmentRequiredGate` 가 덮는다).
 * 켜기 마법사는 설정의 것과 같고, 다만 열자마자 본인 확인 없이 시작해 본다: 방금 로그인한 계정은 서버가 증거 없이 받는다 - 소셜 전용 계정도 지나간다.
 * 서버가 증거를 요구하면 평소처럼 묻는다. 로그아웃은 늘 있다. 이메일 필수 문(Patterns/Auth/Email required)과 같은 자리의 막이다
 */
const meta = {
  title: 'Patterns/Auth/Two-factor required',
  component: MfaEnrollmentRequiredScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    api: createFakeMfaApi({ exempt: true }).api,
    subject: { hasPassword: true, email: 'ann@example.com', providers: [] },
    labels: koAuthLabels,
    onEnrolled: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof MfaEnrollmentRequiredScreen>
export default meta
type Story = StoryObj<typeof meta>

const typeCode = async (code: string) => {
  const first = await screen.findByLabelText('6자리 중 1번째')
  await user.type(first, code)
}

export const JustLoggedInSkipsTheProof: Story = {
  render: (args) => {
    const fake = createFakeMfaApi({ exempt: true })
    return <MfaEnrollmentRequiredScreen {...args} api={fake.api} />
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '2단계 인증을 켜 주세요' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '지금 켜기' }))
    // 비밀번호를 묻지 않고 바로 비밀 문자열과 QR 이 나온다
    const wizard = within(await screen.findByRole('dialog', { name: '2단계 인증 켜기' }))
    await expect(await wizard.findByText(FAKE_TOTP_SECRET)).toBeVisible()
    await expect(wizard.queryByLabelText(/^현재 비밀번호/)).toBeNull()
    await typeCode(FAKE_TOTP_CODE)
    // 복구 코드는 저장했다고 하기 전에는 이 화면이 풀리지 않는다
    const codes = within(await screen.findByRole('dialog', { name: '복구 코드를 저장해 주세요' }))
    await expect(codes.getByText(FAKE_RECOVERY_CODES[0])).toBeVisible()
    await expect(args.onEnrolled).not.toHaveBeenCalled()
    await userEvent.click(codes.getByRole('button', { name: '저장했어요' }))
    await expect(args.onEnrolled).toHaveBeenCalledTimes(1)
  },
}

export const AsksForThePasswordWhenTheServerWantsProof: Story = {
  render: (args) => <MfaEnrollmentRequiredScreen {...args} api={createFakeMfaApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '지금 켜기' }))
    const wizard = within(await screen.findByRole('dialog', { name: '2단계 인증 켜기' }))
    // 증거 없는 시작이 거절되면(로그인한 지 오래됐다) 평소 마법사의 본인 확인 단계다
    await userEvent.type(await wizard.findByLabelText(/^현재 비밀번호/), FAKE_MFA_PASSWORD)
    await userEvent.click(wizard.getByRole('button', { name: '계속' }))
    await expect(await wizard.findByText(FAKE_TOTP_SECRET)).toBeVisible()
  },
}

export const SocialOnlyAccountContinuesInSettings: Story = {
  args: {
    subject: { hasPassword: false, email: null, providers: ['google'] },
    onProviderReauth: fn(),
  },
  render: (args) => <MfaEnrollmentRequiredScreen {...args} api={createFakeMfaApi().api} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '지금 켜기' }))
    const wizard = within(await screen.findByRole('dialog', { name: '2단계 인증 켜기' }))
    // 제공자 동의 왕복은 계정 설정에 있다 - 앱이 거기로 보낸다
    await userEvent.click(await wizard.findByRole('button', { name: 'Google 로 확인' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('google')
  },
}

export const SigningOutIsAlwaysThere: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '로그아웃' }))
    await expect(args.onSignOut).toHaveBeenCalledTimes(1)
  },
}

export const ComingBackFromAnotherWindowKeepsTheRecoveryCodes: Story = {
  render: () => {
    const fake = createFakeMfaApi({ exempt: true })
    const controller = createMfaEnrollmentRequiredController()
    void controller.recover({
      path: '/notes',
      method: 'GET',
      error: apiError('MFA.ENROLLMENT_REQUIRED', 403),
    })
    const account = {
      me: async () => ({ hasPassword: true, email: 'ann@example.com', methods: [] }) as never,
      requestReauthConfirmation: async () => undefined as never,
    }
    return (
      <MfaEnrollmentRequiredGate
        controller={controller}
        api={fake.api}
        account={account}
        accountId="a"
        labels={koAuthLabels}
        onSignOut={() => undefined}
      >
        <p>앱 화면</p>
      </MfaEnrollmentRequiredGate>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '지금 켜기' }))
    await typeCode(FAKE_TOTP_CODE)
    const codes = within(await screen.findByRole('dialog', { name: '복구 코드를 저장해 주세요' }))
    // 서버는 이미 켜졌다 - 비밀번호 관리자 같은 다른 창에 다녀와도(focus) 저장 확인 전에는 막이 걷히지 않는다
    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(codes.getByText(FAKE_RECOVERY_CODES[0])).toBeVisible()
    await userEvent.click(codes.getByRole('button', { name: '저장했어요' }))
    await waitFor(() =>
      expect(canvas.queryByRole('heading', { name: '2단계 인증을 켜 주세요' })).toBeNull(),
    )
  },
}
