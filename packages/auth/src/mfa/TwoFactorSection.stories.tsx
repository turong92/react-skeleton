import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, screen, userEvent as user, waitFor, within } from 'storybook/test'
import type { ReauthSubject } from '../reauth/kind'
import { koAuthLabels } from '../screens/labels.ko'
import {
  createFakeMfaApi,
  FAKE_MFA_PASSWORD,
  FAKE_OTPAUTH,
  FAKE_QR,
  FAKE_RECOVERY_CODE,
  FAKE_RECOVERY_CODES,
  FAKE_SOCIAL_CODE,
  FAKE_TOTP_CODE,
  FAKE_TOTP_SECRET,
} from '../stories/fakeMfaApi'
import { TwoFactorSection } from './TwoFactorSection'

/**
 * 계정 설정의 「2단계 인증」 줄 - 상태(꺼짐 · 켜짐 · 남은 복구 코드), 「켜기」 마법사(본인 확인 → QR + 비밀 문자열 + 앱에서 열기 → 6자리 확인 → 복구 코드),
 * 「복구 코드 다시 만들기」, 「끄기」(본인 확인 + 코드). **복구 코드는 「저장했어요」를 누르기 전에는 대화상자가 닫히지 않는다** - 닫으면 다시 볼 수 없다.
 * 설정 화면(Patterns/설정)의 줄 모양을 따른다
 */
const subject: ReauthSubject = { hasPassword: true, email: 'ann@example.com', providers: [] }

const meta = {
  title: 'Packages/auth/TwoFactorSection',
  component: TwoFactorSection,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeMfaApi().api,
    subject,
    labels: koAuthLabels,
    formatDate: (iso: string) => iso.slice(0, 10),
  },
} satisfies Meta<typeof TwoFactorSection>
export default meta
type Story = StoryObj<typeof meta>

const openDialog = async (name: string) => within(await screen.findByRole('dialog', { name }))
const typeCode = async (code: string) => {
  const first = await screen.findByLabelText('6자리 중 1번째')
  await user.type(first, code)
}

export const Off: Story = {
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi().api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('꺼져 있어요')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '2단계 인증 켜기' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '2단계 인증 끄기' })).toBeNull()
  },
}

export const On: Story = {
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi({ enabled: true }).api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('켜져 있어요')).toBeVisible()
    await expect(canvas.getByText('복구 코드 8개 남았어요')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '복구 코드 다시 만들기' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '인증 앱 바꾸기' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '2단계 인증 끄기' })).toBeVisible()
  },
}

export const LowOnRecoveryCodesWarns: Story = {
  render: (args) => (
    <TwoFactorSection {...args} api={createFakeMfaApi({ enabled: true, remaining: 1 }).api} />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/복구 코드가 거의 없어요/)).toBeVisible()
  },
}

export const EnableWizardKeepsTheRecoveryCodesUntilSaved: Story = {
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '2단계 인증 켜기' }))
    // 1. 본인 확인
    const reauth = await openDialog('2단계 인증 켜기')
    await userEvent.type(reauth.getByLabelText(/^현재 비밀번호/), FAKE_MFA_PASSWORD)
    await userEvent.click(reauth.getByRole('button', { name: '계속' }))
    // 2. QR + 비밀 문자열 + 앱에서 열기 - QR 은 서버가 준 경로를 그대로 그린다(라이브러리 · innerHTML 없음)
    const scan = await openDialog('2단계 인증 켜기')
    const qr = await scan.findByRole('img', { name: '인증 앱용 QR 코드' })
    await expect(qr.querySelector('path')?.getAttribute('d')).toBe(FAKE_QR.path)
    // 서버의 size 는 사방 4칸 여백을 포함한다 - viewBox 는 그대로 `0 0 size size`
    await expect(qr.getAttribute('viewBox')).toBe(`0 0 ${FAKE_QR.size} ${FAKE_QR.size}`)
    await expect(scan.getByText(FAKE_TOTP_SECRET)).toBeVisible()
    await expect(scan.getByRole('link', { name: '앱에서 바로 열기' })).toHaveAttribute(
      'href',
      FAKE_OTPAUTH,
    )
    // 틀린 코드
    await typeCode('000000')
    await expect(await scan.findByText('코드가 맞지 않아요. 다시 확인해 주세요.')).toBeVisible()
    await typeCode(FAKE_TOTP_CODE)
    // 3. 복구 코드 - 열 개가 보이고, 저장했다고 하기 전에는 닫히지 않는다
    const codes = await openDialog('복구 코드를 저장해 주세요')
    for (const code of FAKE_RECOVERY_CODES) await expect(codes.getByText(code)).toBeVisible()
    await expect(codes.getByRole('button', { name: '복사' })).toBeVisible()
    await expect(codes.getByRole('button', { name: '내려받기' })).toBeVisible()
    await expect(screen.queryByRole('button', { name: '닫기' })).toBeNull() // × 가 없다
    // Esc(cancel)도, 브라우저가 cancel 을 건너뛰고 닫는 연달아 누른 Esc 도 열려 있다
    const sticky = screen.getByRole('dialog', {
      name: '복구 코드를 저장해 주세요',
    }) as HTMLDialogElement
    sticky.requestClose()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await expect(sticky).toBeVisible()
    sticky.close()
    await waitFor(() => expect(sticky.open).toBe(true))
    await userEvent.click(codes.getByRole('button', { name: '저장했어요' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // 닫은 뒤에는 어디에도 없다 - 비밀 문자열도 복구 코드도
    await expect(await canvas.findByText('켜져 있어요')).toBeVisible()
    for (const secret of [FAKE_TOTP_SECRET, FAKE_OTPAUTH, ...FAKE_RECOVERY_CODES])
      await expect(document.body.textContent).not.toContain(secret)
    await expect(document.body.innerHTML).not.toContain(FAKE_TOTP_SECRET)
  },
}

export const WrongPasswordStopsAtTheFirstStep: Story = {
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '2단계 인증 켜기' }))
    const reauth = await openDialog('2단계 인증 켜기')
    await userEvent.type(reauth.getByLabelText(/^현재 비밀번호/), 'nope')
    await userEvent.click(reauth.getByRole('button', { name: '계속' }))
    await expect(await reauth.findByText(koAuthLabels.errorCurrentPassword)).toBeVisible()
    await expect(screen.queryByRole('img', { name: '인증 앱용 QR 코드' })).toBeNull()
  },
}

export const ReEnrollingAnAppNeedsNoNewRecoveryCodes: Story = {
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi({ enabled: true }).api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '인증 앱 바꾸기' }))
    const reauth = await openDialog('인증 앱 바꾸기')
    await userEvent.type(reauth.getByLabelText(/^현재 비밀번호/), FAKE_MFA_PASSWORD)
    await userEvent.click(reauth.getByRole('button', { name: '계속' }))
    await screen.findByRole('img', { name: '인증 앱용 QR 코드' })
    await typeCode(FAKE_TOTP_CODE)
    // 서버가 복구 코드를 주지 않는다(기존 코드 유지) - 마법사가 닫히고 알린다
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await canvas.findByText('인증 앱을 바꿨어요.')).toBeVisible()
  },
}

export const RegenerateShowsTheNewCodesOnce: Story = {
  render: (args) => (
    <TwoFactorSection {...args} api={createFakeMfaApi({ enabled: true, remaining: 2 }).api} />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '복구 코드 다시 만들기' }))
    const reauth = await openDialog('복구 코드 다시 만들기')
    await expect(reauth.getByText(/이전 복구 코드는 더 쓸 수 없어요/)).toBeVisible()
    await userEvent.type(reauth.getByLabelText(/^현재 비밀번호/), FAKE_MFA_PASSWORD)
    await userEvent.click(reauth.getByRole('button', { name: '새 복구 코드 만들기' }))
    const codes = await openDialog('복구 코드를 저장해 주세요')
    await expect(codes.getByText(FAKE_RECOVERY_CODES[0])).toBeVisible()
    await userEvent.click(codes.getByRole('button', { name: '저장했어요' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await canvas.findByText('복구 코드 10개 남았어요')).toBeVisible()
    await expect(document.body.textContent).not.toContain(FAKE_RECOVERY_CODES[0])
  },
}

export const DisableAsksForPasswordAndACode: Story = {
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi({ enabled: true }).api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '2단계 인증 끄기' }))
    const dialog = await openDialog('2단계 인증 끄기')
    await userEvent.type(dialog.getByLabelText(/^현재 비밀번호/), FAKE_MFA_PASSWORD)
    // 코드 없이는 보내지 않는다
    await userEvent.click(dialog.getByRole('button', { name: '끄기' }))
    await expect(await dialog.findByText('인증 앱 코드나 복구 코드를 입력해 주세요.')).toBeVisible()
    // 틀린 코드
    await userEvent.type(dialog.getByLabelText(/^인증 앱 코드 또는 복구 코드/), '000000')
    await userEvent.click(dialog.getByRole('button', { name: '끄기' }))
    await expect(await dialog.findByText('코드가 맞지 않아요. 다시 확인해 주세요.')).toBeVisible()
    // 복구 코드로도 끌 수 있다
    const box = dialog.getByLabelText(/^인증 앱 코드 또는 복구 코드/)
    await userEvent.clear(box)
    await userEvent.type(box, FAKE_RECOVERY_CODE)
    await userEvent.click(dialog.getByRole('button', { name: '끄기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await canvas.findByText('꺼져 있어요')).toBeVisible()
  },
}

export const RequiredByPolicyCannotBeTurnedOff: Story = {
  render: (args) => (
    <TwoFactorSection {...args} api={createFakeMfaApi({ enabled: true, required: true }).api} />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('켜져 있어요')).toBeVisible()
    await expect(canvas.getByText(/이 계정은 2단계 인증이 필수예요/)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '2단계 인증 끄기' })).toBeNull()
    // 재등록은 된다
    await expect(canvas.getByRole('button', { name: '인증 앱 바꾸기' })).toBeVisible()
  },
}

export const NotEnabledOnTheServer: Story = {
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi({ off: true }).api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/서버에서 2단계 인증을 켜지 않았어요/)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '2단계 인증 켜기' })).toBeNull()
  },
}

/* 비밀번호도 이메일도 없는 계정(소셜 로그인만) - 제공자 동의를 다녀온다. 인가 코드는 한 번 쓰면 끝이고, 쓰자마자 비운다 */
const socialOnly: ReauthSubject = { hasPassword: false, email: null, providers: ['google'] }
const googleBack = {
  action: { kind: 'mfa-enable' as const },
  socialReauth: { provider: 'google', authorizationCode: FAKE_SOCIAL_CODE },
}

export const SocialOnlyAccountGoesToTheProviderToConfirm: Story = {
  args: { subject: socialOnly, onProviderReauth: fn() },
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi().api} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '2단계 인증 켜기' }))
    const dialog = await openDialog('2단계 인증 켜기')
    await userEvent.click(dialog.getByRole('button', { name: 'Google 로 확인' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('google', { kind: 'mfa-enable' })
  },
}

export const SocialOnlyAccountWithoutTheProviderFlowOnlyGetsAGuide: Story = {
  args: { subject: socialOnly },
  render: (args) => <TwoFactorSection {...args} api={createFakeMfaApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '2단계 인증 켜기' }))
    const dialog = await openDialog('2단계 인증 켜기')
    await expect(dialog.getByText(/비밀번호나 이메일을 먼저 등록해 주세요/)).toBeVisible()
  },
}

export const BackFromTheProviderTheDialogReopensConfirmedAndSendsTheEvidenceOnce: Story = {
  args: { subject: socialOnly, onProviderReauth: fn(), resume: googleBack, onResumeSpent: fn() },
  render: (args) => {
    const fake = createFakeMfaApi()
    ;(window as unknown as { __mfa: typeof fake }).__mfa = fake
    return <TwoFactorSection {...args} api={fake.api} />
  },
  play: async ({ userEvent, args }) => {
    const dialog = await openDialog('2단계 인증 켜기')
    await expect(await dialog.findByText('Google 로 확인했어요.')).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: '계속' }))
    await screen.findByRole('img', { name: '인증 앱용 QR 코드' })
    const { inputs } = (window as unknown as { __mfa: ReturnType<typeof createFakeMfaApi> }).__mfa
    // 비밀번호 없이 제공자 증거만 실렸고, 그 코드는 곧 비워졌다
    await expect(inputs()).toEqual([
      { socialReauth: { provider: 'google', authorizationCode: FAKE_SOCIAL_CODE } },
    ])
    await expect(args.onResumeSpent).toHaveBeenCalledOnce()
  },
}

/** 앱처럼 쓰고 난 증거를 비운다 */
function Spendable(args: React.ComponentProps<typeof TwoFactorSection>) {
  const [resume, setResume] = useState(args.resume)
  return (
    <TwoFactorSection
      {...args}
      resume={resume}
      onResumeSpent={() => {
        setResume(null)
        args.onResumeSpent?.()
      }}
    />
  )
}

export const ARejectedProviderCodeIsSpentAndAsksForAnotherTrip: Story = {
  args: {
    subject: socialOnly,
    onProviderReauth: fn(),
    resume: { ...googleBack, socialReauth: { provider: 'google', authorizationCode: 'stale' } },
    onResumeSpent: fn(),
  },
  render: (args) => <Spendable {...args} api={createFakeMfaApi().api} />,
  play: async ({ userEvent, args }) => {
    const dialog = await openDialog('2단계 인증 켜기')
    await userEvent.click(await dialog.findByRole('button', { name: '계속' }))
    await expect(await dialog.findByText(koAuthLabels.errorReauth)).toBeVisible()
    await expect(args.onResumeSpent).toHaveBeenCalledOnce()
    // 쓴 증거는 비워져 다시 제공자에 다녀와야 한다
    await expect(await dialog.findByRole('button', { name: 'Google 로 확인' })).toBeVisible()
    await expect(screen.queryByRole('img', { name: '인증 앱용 QR 코드' })).toBeNull()
  },
}
