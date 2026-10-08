import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { createEmailRequiredController } from '../emailRequired'
import { EmailRequiredGate } from '../screens/EmailRequiredGate'
import { koAuthLabels } from '../screens/labels.ko'
import {
  apiError,
  createFakeAccountApi,
  FAKE_CODE,
  type FakeAccountOptions,
} from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 이메일 등록 강제 — 이메일이 필수인 앱에서 주소 없는 계정(카카오 · 네이버 · X · 비-Gmail 구글 가입)이 로그인하면 앱 대신 전면 화면이 덮는다(`EmailRequiredGate`).
 * 주소 → 6자리 인증번호(서버의 `expiresAt` · `resendAvailableAt` 로 센다) → 끝나면 막혔던 호출이 다시 나가 가던 자리에서 이어진다. 떠나는 길(로그아웃 · 계정 삭제)이 늘 있다.
 * 약관 재동의 막(`ReconsentGate`) 바깥에 둔다 — 한 번에 하나, 순서는 이메일 → 약관 → 닉네임.
 */

function AppBehind({ children }: { children?: ReactNode }) {
  return (
    <main>
      <h1>내 노트</h1>
      <p>앱 화면</p>
      {children}
    </main>
  )
}

type DemoProps = {
  fake?: FakeAccountOptions
  standAside?: boolean
  /** 앱이 로그인에 켠 소셜 제공자 — 계정에 연결된 것 중 이것만 재동의에 쓴다(없으면 거르지 않는다) */
  enabledProviders?: string[]
  korean?: boolean
  onRegistered?: () => void
  onSignOut?: () => void
  onDiscarded?: (provider?: string) => void
  onDiscardReauth?: (provider: string) => void
  onProviderReauth?: (provider: string, newEmail: string) => void
  /** 화면 폭(px) — `transform` 이 `position: fixed` 의 기준을 이 칸으로 바꿔 작은 폭에서의 모습을 그대로 본다 */
  width?: number
}

function Demo({
  fake,
  standAside,
  enabledProviders,
  korean,
  onRegistered,
  onSignOut = () => undefined,
  onDiscarded = () => undefined,
  onDiscardReauth,
  onProviderReauth,
  width,
}: DemoProps) {
  const api = useMemo(() => createFakeAccountApi({ emailRequired: true, ...fake }), [fake])
  const controller = useMemo(() => createEmailRequiredController(), [])
  // 앱이 보낸 호출이 403 으로 막혔다 — 컨트롤러가 붙잡고 있다가 등록이 끝나면 풀어 준다
  useEffect(() => {
    void controller.recover({
      path: '/notes',
      method: 'GET',
      error: apiError('ACCOUNT.EMAIL_REQUIRED', 403),
    })
  }, [controller])
  const gate = (
    <EmailRequiredGate
      controller={controller}
      api={api}
      accountId="acc_demo"
      labels={korean ? koAuthLabels : undefined}
      standAside={standAside}
      enabledProviders={enabledProviders}
      onSignOut={onSignOut}
      onDiscarded={onDiscarded}
      onDiscardReauth={onDiscardReauth}
      onRegistered={onRegistered}
      onProviderReauth={onProviderReauth}
    >
      <AppBehind />
    </EmailRequiredGate>
  )
  return width ? (
    <div
      style={{
        width,
        height: 700,
        transform: 'translateZ(0)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    >
      {gate}
    </div>
  ) : (
    gate
  )
}

const meta = {
  title: 'Patterns/Auth/Email required',
  component: Demo,
  decorators: [withRouter],
  args: {
    onRegistered: fn(),
    onSignOut: fn(),
    onDiscarded: fn(),
    onDiscardReauth: fn(),
    onProviderReauth: fn(),
  },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof Demo>

const dialog = (canvas: ReturnType<typeof within>, name = 'Add your email address') =>
  canvas.findByRole('dialog', { name })

/** 입력 → 인증번호 → 끝: 앱이 inert 에서 풀리고 `onRegistered` 가 불린다 */
export const AddressThenCodeThenDone: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    // 뒤의 앱은 만질 수 없다 — 한 번에 하나만
    await expect(canvas.getByText('앱 화면').closest('[inert]')).not.toBeNull()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Add your email address' })).toHaveFocus(),
    )
    await expect(screen.getByText(/Nobody else can see it/)).toBeVisible()
    // 비어 있으면 이유를 말하고 그 칸으로 간다 — 단추는 늘 눌린다
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
    await expect(
      await screen.findByRole('button', { name: 'Enter your email address' }),
    ).toBeVisible()
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveFocus())
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
    await expect(await screen.findByText(/We sent a 6-digit code to me@example.com/)).toBeVisible()
    await expect(await screen.findByText(/^Time left (10:00|09:5\d)$/)).toBeVisible()
    // 누른 단추는 사라졌다 — 포커스는 인증번호 첫 칸으로
    await waitFor(() => expect(screen.getAllByLabelText('Digit 1 of 6')[0]).toHaveFocus())
    // 틀린 번호는 남은 횟수와 함께
    await userEvent.click(screen.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste('000000')
    await expect(await screen.findByText(/not right\. 4 attempts left/)).toBeVisible()
    await userEvent.click(screen.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste(FAKE_CODE)
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
    await expect(args.onRegistered).toHaveBeenCalledTimes(1)
  },
}

/** 번호가 안 오면 — 남이 이미 쓰는 주소일 수 있다. 서버는 똑같이 202 로 답하고 번호는 가지 않는다: 안내와 「주소 고치기」 */
export const AddressAlreadyUsedByAnotherAccount: Story = {
  args: { fake: { takenEmails: ['taken@example.com'] } },
  play: async ({ canvas, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'taken@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
    await expect(
      await screen.findByText(/We sent a 6-digit code to taken@example.com/),
    ).toBeVisible()
    await expect(
      screen.getByText(/An account may already exist for that address.*link Kakao/),
    ).toBeVisible()
    // 어떤 번호도 통하지 않는다 — 횟수가 줄 뿐
    await userEvent.click(screen.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste(FAKE_CODE)
    await expect(await screen.findByText(/not right\. 4 attempts left/)).toBeVisible()
    // 주소를 고치러 간다 — 입력 칸으로, 쓴 주소가 남아 있다
    await userEvent.click(screen.getByRole('button', { name: 'Fix the address' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveFocus())
  },
}

/** 마지막 로그인이 1시간을 넘었다 — 서버가 제공자 재동의를 요구한다. 오류 문구 대신 한 줄 안내와 채운 단추 */
export const MoreThanAnHourLaterAsksTheProviderAgain: Story = {
  args: { fake: { reauthWindowExpired: true } },
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
    await expect(await screen.findByText(/confirm once more with Kakao/)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm with Kakao' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('kakao', 'me@example.com')
  },
}

/** 새로고침 · 다시 들어옴 — 서버가 대기 중인 변경(`me.pendingEmail`)을 알려 주면 주소 입력으로 돌아가지 않고 인증번호 단계가 열린다 */
export const ReloadRestoresTheCodeStep: Story = {
  args: { fake: { pendingEmail: 'waiting@example.com', pendingExpiresInMinutes: 7 } },
  play: async ({ canvas }) => {
    const screen = within(await dialog(canvas))
    await expect(await screen.findByText(/waiting@example.com/)).toBeVisible()
    await expect(screen.getByLabelText('Digit 1 of 6')).toBeVisible()
    await expect(screen.getByText(/^Time left/)).toBeVisible()
    await expect(screen.queryByRole('button', { name: 'Send me a code' })).toBeNull()
  },
}

/** 서버가 재동의를 요구하는데 쓸 수 있는 제공자가 하나도 없다(앱이 켜지 않았다) - 「문의해 주세요」만 남지 않고 다시 시도할 수 있다 */
export const NoProviderLeftCanTryAgain: Story = {
  args: { fake: { reauthWindowExpired: true }, enabledProviders: ['line'] },
  play: async ({ canvas, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
    await expect(await screen.findByText(/None of your sign-in methods/)).toBeVisible()
    await expect(screen.queryByRole('button', { name: /Confirm with/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await expect(screen.getByRole('button', { name: 'Send me a code' })).toBeVisible()
    await expect(screen.queryByText(/None of your sign-in methods/)).toBeNull()
  },
}

/** 막다른 길이 아니다 - 로그아웃은 늘 눌리고, 이미 계정이 있으면 빈 계정을 지우는 길이 있다(확인 한 번) */
export const WaysOutAreRealButtons: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await expect(screen.getByRole('heading', { name: 'Already have an account?' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledTimes(1)
  },
}

/** 「이 계정 지우고 로그인 화면으로」 - 한 번 확인한 뒤 지우고, 앱에 로그인 뒤 연결을 이어 갈 제공자를 알린다 */
export const AlreadyHaveAnAccountDiscardsTheEmptyOneAfterOneConfirmation: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete this account and go to sign-in' }),
    )
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'Delete this account?',
    })
    await expect(args.onDiscarded).not.toHaveBeenCalled() // 눌렀다고 바로 지우지 않는다
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete and go to sign-in' }))
    await waitFor(() => expect(args.onDiscarded).toHaveBeenCalledWith('kakao'))
  },
}

export const DiscardCanBeCancelled: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete this account and go to sign-in' }),
    )
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'Delete this account?',
    })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(
        within(document.body).queryByRole('dialog', { name: 'Delete this account?' }),
      ).toBeNull(),
    )
    await expect(args.onDiscarded).not.toHaveBeenCalled()
  },
}

/** 오래된 세션이라 서버가 제공자 재동의를 요구한다 - 확인 창이 닫히고 그 제공자 단추가 나온다 */
export const DiscardOnAnOldSessionAsksTheProviderAgain: Story = {
  args: { fake: { reauthWindowExpired: true } },
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete this account and go to sign-in' }),
    )
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'Delete this account?',
    })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete and go to sign-in' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm with Kakao' }))
    await expect(args.onDiscardReauth).toHaveBeenCalledWith('kakao')
    await expect(args.onDiscarded).not.toHaveBeenCalled()
  },
}

/** 계정 설정 쪽에서 등록하거나 삭제하는 동안은 막이 걷힌다(앱 화면이 살아 있다) */
export const StandsAsideOnTheAccountPage: Story = {
  args: { standAside: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('앱 화면')).toBeVisible()
    await expect(canvas.queryByRole('dialog')).toBeNull()
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
  },
}

/**
 * 계정은 막의 일부다 — 다른 탭에서 다른 계정으로 로그인하면(토큰 저장소가 탭끼리 동기화된다) 이 탭의 `accountId` 가 A → B 가 된다.
 * A 가 붙잡아 둔 호출은 B 의 토큰으로 나가지 않고 원래 403 으로 끝나며, 막도 접힌다(B 가 주소를 가지고 있으면 그대로 앱이다)
 */
function SwitchedAccountDemo({ onSettled }: { onSettled: (result: boolean) => void }) {
  const [accountId, setAccountId] = useState('acc_a')
  const api = useMemo(() => createFakeAccountApi({ emailRequired: true }), [])
  const controller = useMemo(() => createEmailRequiredController(), [])
  useEffect(() => {
    void controller
      .recover({ path: '/notes', method: 'GET', error: apiError('ACCOUNT.EMAIL_REQUIRED', 403) })
      .then(onSettled)
  }, [controller, onSettled])
  return (
    <>
      <button type="button" onClick={() => setAccountId('acc_b')}>
        다른 탭에서 B 로 로그인
      </button>
      <EmailRequiredGate
        controller={controller}
        api={{
          ...api,
          me: async () => ({ ...(await api.me()), emailRequired: accountId === 'acc_a' }),
        }}
        accountId={accountId}
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <AppBehind />
      </EmailRequiredGate>
    </>
  )
}

export const AnotherAccountSignedInInAnotherTab: StoryObj<typeof SwitchedAccountDemo> = {
  render: (args) => <SwitchedAccountDemo {...args} />,
  args: { onSettled: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await dialog(canvas)
    await userEvent.click(canvas.getByRole('button', { name: '다른 탭에서 B 로 로그인' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    // A 가 붙잡은 호출은 다시 나가지 않고(true 가 아니다) 원래 403 으로 끝난다
    await waitFor(() => expect(args.onSettled).toHaveBeenCalledWith(false))
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
  },
}

/** 같은 계정을 연 다른 탭에서 이미 등록했다 — 이 탭이 다시 보일 때(포커스) 서버에 묻고, 막을 접고, 붙잡은 호출을 보낸다 */
function RegisteredElsewhereDemo({ onSettled }: { onSettled: (result: boolean) => void }) {
  const [serverRequires, setServerRequires] = useState(true)
  const api = useMemo(() => createFakeAccountApi({ emailRequired: true }), [])
  const controller = useMemo(() => createEmailRequiredController(), [])
  useEffect(() => {
    void controller
      .recover({ path: '/notes', method: 'GET', error: apiError('ACCOUNT.EMAIL_REQUIRED', 403) })
      .then(onSettled)
  }, [controller, onSettled])
  return (
    <>
      <button type="button" onClick={() => setServerRequires(false)}>
        다른 탭에서 등록 끝
      </button>
      <EmailRequiredGate
        controller={controller}
        api={{ ...api, me: async () => ({ ...(await api.me()), emailRequired: serverRequires }) }}
        accountId="acc_a"
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <AppBehind />
      </EmailRequiredGate>
    </>
  )
}

export const RegisteredInAnotherTabOfTheSameAccount: StoryObj<typeof RegisteredElsewhereDemo> = {
  render: (args) => <RegisteredElsewhereDemo {...args} />,
  args: { onSettled: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await dialog(canvas)
    await userEvent.click(canvas.getByRole('button', { name: '다른 탭에서 등록 끝' }))
    window.dispatchEvent(new Event('focus')) // 탭이 다시 보인다
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(args.onSettled).toHaveBeenCalledWith(true))
  },
}

/** 로그인 직후 `me.emailRequired === true` 만으로 막이 열리고(403 호출 없이), 서버에 물어 답을 받으면 다음 단계(약관 …)가 물어도 된다고 알린다 */
function OpensFromMeDemo({ fake }: { fake: FakeAccountOptions }) {
  const api = useMemo(() => createFakeAccountApi(fake), [fake])
  const controller = useMemo(() => createEmailRequiredController(), [])
  const ready = useSyncExternalStore(controller.subscribe, controller.isReady, controller.isReady)
  return (
    <>
      <output aria-label="ready">{String(ready)}</output>
      <EmailRequiredGate
        controller={controller}
        api={api}
        accountId="acc_a"
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <AppBehind />
      </EmailRequiredGate>
    </>
  )
}

export const MeSaysRequiredOpensTheScreenAndTheNextStepWaitsForTheAnswer: StoryObj<
  typeof OpensFromMeDemo
> = {
  render: (args) => <OpensFromMeDemo {...args} />,
  args: { fake: { emailRequired: true } },
  play: async ({ canvas }) => {
    await dialog(canvas)
    await waitFor(() => expect(canvas.getByLabelText('ready')).toHaveTextContent('true'))
  },
}

export const MeSaysNotRequiredLeavesTheAppAlone: StoryObj<typeof OpensFromMeDemo> = {
  render: (args) => <OpensFromMeDemo {...args} />,
  args: { fake: {} },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByLabelText('ready')).toHaveTextContent('true'))
    await expect(canvas.queryByRole('dialog')).toBeNull()
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
  },
}

/** 막이 닫히면 포커스가 열리기 전의 자리로 돌아온다 - 뒤 화면의 단추에 있던 포커스가 문서 맨 앞으로 날아가지 않는다 */
function FocusBackDemo() {
  const api = useMemo(() => createFakeAccountApi({ emailRequired: true }), [])
  const controller = useMemo(() => createEmailRequiredController(), [])
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    button.current?.focus()
    controller.require()
    const timer = window.setTimeout(() => controller.registered(), 800)
    return () => window.clearTimeout(timer)
  }, [controller])
  return (
    <EmailRequiredGate
      controller={controller}
      api={{ ...api, me: async () => ({ ...(await api.me()), emailRequired: true }) }}
      accountId="acc_a"
      onSignOut={() => undefined}
      onDiscarded={() => undefined}
    >
      <button ref={button} type="button">
        연결하기
      </button>
    </EmailRequiredGate>
  )
}

export const ClosingGivesTheFocusBack: StoryObj<typeof FocusBackDemo> = {
  render: () => <FocusBackDemo />,
  play: async ({ canvas }) => {
    await dialog(canvas)
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(canvas.getByRole('button', { name: '연결하기' })).toHaveFocus())
  },
}

/** 로그아웃 단추를 **눌러서** 끝까지 — 막이 접히고 붙잡힌 호출은 403 으로 끝나며 `onSignOut` 이 불린다 */
function SignOutThroughTheGateDemo({ onSettled }: { onSettled: (result: boolean) => void }) {
  const [accountId, setAccountId] = useState<string | null>('acc_a')
  const api = useMemo(() => createFakeAccountApi({ emailRequired: true }), [])
  const controller = useMemo(() => createEmailRequiredController(), [])
  useEffect(() => {
    void controller
      .recover({ path: '/notes', method: 'GET', error: apiError('ACCOUNT.EMAIL_REQUIRED', 403) })
      .then(onSettled)
  }, [controller, onSettled])
  return (
    <EmailRequiredGate
      controller={controller}
      api={api}
      accountId={accountId}
      onSignOut={() => setAccountId(null)}
      onDiscarded={() => undefined}
    >
      <AppBehind />
    </EmailRequiredGate>
  )
}

export const SigningOutEndsTheHeldCalls: StoryObj<typeof SignOutThroughTheGateDemo> = {
  render: (args) => <SignOutThroughTheGateDemo {...args} />,
  args: { onSettled: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(args.onSettled).toHaveBeenCalledWith(false)
  },
}

/** 한국어 */
export const Korean: Story = {
  args: { korean: true },
  play: async ({ canvas, userEvent }) => {
    const screen = within(await dialog(canvas, '이메일을 등록해 주세요'))
    await expect(
      screen.getByText(
        '계정을 되찾거나 중요한 안내를 받을 때 써요. 다른 사람에게는 보이지 않아요.',
      ),
    ).toBeVisible()
    await userEvent.type(screen.getByRole('textbox', { name: /^이메일/ }), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: '인증번호 받기' }))
    await expect(
      await screen.findByText(/me@example.com 로 6자리 인증번호를 보냈어요/),
    ).toBeVisible()
    await expect(
      screen.getByText(/번호가 안 오면 그 주소로 이미 가입한 계정이 있을 수 있어요/),
    ).toBeVisible()
    await expect(screen.getByRole('button', { name: '주소 고치기' })).toBeVisible()
  },
}

/** 한국어 · 1시간이 지난 재동의 */
export const KoreanReauth: Story = {
  args: { korean: true, fake: { reauthWindowExpired: true } },
  play: async ({ canvas, userEvent }) => {
    const screen = within(await dialog(canvas, '이메일을 등록해 주세요'))
    await userEvent.type(screen.getByRole('textbox', { name: /^이메일/ }), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: '인증번호 받기' }))
    await expect(await screen.findByText(/보안을 위해 한 번 더 확인해 주세요/)).toBeVisible()
  },
}

const noHorizontalScroll = async (canvas: ReturnType<typeof within>) => {
  const screen = await dialog(canvas, '이메일을 등록해 주세요')
  await waitFor(() => expect(screen.scrollWidth).toBeLessThanOrEqual(screen.clientWidth))
}

/** 320px — 가로로 밀리지 않고 단추가 칸을 채운다 */
export const Narrow320: Story = {
  args: { width: 320, korean: true },
  play: async ({ canvas, userEvent }) => {
    await noHorizontalScroll(canvas)
    const screen = within(await dialog(canvas, '이메일을 등록해 주세요'))
    await userEvent.type(
      screen.getByRole('textbox', { name: /^이메일/ }),
      'long-address-for-a-narrow-phone@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: '인증번호 받기' }))
    await screen.findByText(/인증번호를 보냈어요/)
    await noHorizontalScroll(canvas)
  },
}

/** 375px */
export const Narrow375: Story = {
  args: { width: 375, korean: true },
  play: async ({ canvas }) => {
    await noHorizontalScroll(canvas)
  },
}
