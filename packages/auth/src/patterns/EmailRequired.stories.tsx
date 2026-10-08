import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { createEmailRequiredController } from '../emailRequired'
import { EmailRequiredGate } from '../screens/EmailRequiredGate'
import { EmailWriteNotice } from '../screens/EmailWriteNotice'
import { mergeLabels } from '../screens/labels'
import { koAuthLabels } from '../screens/labels.ko'
import { useEmailBeforeWrite } from '../useEmailBeforeWrite'
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
 *
 * **쓰기 때 모습**(아래 `Write…` 스토리): 서버가 주소를 글을 쓸 때 받으면(`me.emailRequiredToWrite`) 로그인 직후에는 열리지 않고, 쓰기의 403 이나 쓰기 전 확인(`useEmailBeforeWrite`)이 열 때
 * 제목 · 본문이 쓰기용이고 「나중에 하기」가 있다 - 닫으면 붙잡은 호출은 원래 403 으로 끝나고 읽기를 계속한다. 댓글 칸 위에는 막지 않는 띠(`EmailWriteNotice`).
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

/**
 * 막이 읽어 둔 것(대기 중인 인증번호 단계 · 제공자 목록 · 아이디)은 **그 계정의 것**이다 - A 의 `me` 로 연 인증번호 단계가 B 로 바뀐 뒤 B 의 `me` 가 실패해도 남아 있으면 B 의 화면이 A 의 주소로 열린다
 */
function ReadFailsForTheNextAccountDemo() {
  const [accountId, setAccountId] = useState('acc_a')
  const base = useMemo(
    () =>
      createFakeAccountApi({
        emailRequired: true,
        pendingEmail: 'a-waiting@example.com',
        pendingExpiresInMinutes: 7,
      }),
    [],
  )
  const api = useMemo(
    () => ({
      ...base,
      me: async () => {
        if (accountId !== 'acc_a') throw new Error('offline') // B 의 답은 오지 않는다
        return base.me()
      },
    }),
    [base, accountId],
  )
  const controller = useMemo(() => createEmailRequiredController(), [])
  return (
    <>
      <button type="button" onClick={() => setAccountId('acc_b')}>
        다른 탭에서 B 로 로그인
      </button>
      <button type="button" onClick={() => controller.require()}>
        B 의 쓰기가 막혔다
      </button>
      <EmailRequiredGate
        controller={controller}
        api={api}
        accountId={accountId}
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <AppBehind />
      </EmailRequiredGate>
    </>
  )
}

export const ThePreviousAccountsCodeStepDoesNotLinger: StoryObj<
  typeof ReadFailsForTheNextAccountDemo
> = {
  render: () => <ReadFailsForTheNextAccountDemo />,
  play: async ({ canvas, userEvent }) => {
    const first = within(await dialog(canvas))
    await expect(await first.findByText(/a-waiting@example.com/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '다른 탭에서 B 로 로그인' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull()) // A 의 화면은 접혔다
    await userEvent.click(canvas.getByRole('button', { name: 'B 의 쓰기가 막혔다' }))
    const next = within(await dialog(canvas))
    // B 의 `me` 는 읽지 못했다 - A 의 대기 중 주소로 인증번호 단계가 열리면 안 된다: 주소 입력으로 시작한다
    await expect(next.queryByText(/a-waiting@example.com/)).toBeNull()
    await expect(next.getByRole('textbox', { name: /^Email/ })).toBeVisible()
  },
}

/**
 * 바깥 막(아이디 막)이 아직 확인하는 동안 `deferCheck` 로 로그인 직후의 `me` 를 미룬다 - 두 막이 함께 열리면 안쪽 화면이 바깥 막의 `inert` 아래에서 떠 첫 포커스를 잃는다.
 * 미루는 동안은 아무것도 묻지 않고(`isReady` 도 false 라 약관 같은 다음 단계도 기다린다), 풀리면 그때 한 번 묻는다. 계정이 없는 동안(로그아웃)은 풀려도 묻지 않는다
 */
function DeferredCheckDemo({ onMe }: { onMe: () => void }) {
  const [deferred, setDeferred] = useState(true)
  const [accountId, setAccountId] = useState<string | null>('acc_a')
  const base = useMemo(() => createFakeAccountApi({ emailRequired: false }), [])
  const api = useMemo(
    () => ({
      ...base,
      me: async () => {
        onMe()
        return base.me()
      },
    }),
    [base, onMe],
  )
  const controller = useMemo(() => createEmailRequiredController(), [])
  const ready = useSyncExternalStore(controller.subscribe, controller.isReady, controller.isReady)
  return (
    <>
      <output aria-label="ready">{String(ready)}</output>
      <button type="button" onClick={() => setDeferred(false)}>
        바깥 막이 걷혔다
      </button>
      <button
        type="button"
        onClick={() => {
          // 아이디 막의 「로그아웃」 - 막을 접으며(바깥 막이 걷힌다) 로그아웃한다
          setAccountId(null)
          setDeferred(false)
        }}
      >
        바깥 막에서 로그아웃
      </button>
      <EmailRequiredGate
        controller={controller}
        api={api}
        accountId={accountId}
        deferCheck={deferred}
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <AppBehind />
      </EmailRequiredGate>
    </>
  )
}

export const DeferCheckAsksNothingUntilTheOuterGateIsDone: StoryObj<typeof DeferredCheckDemo> = {
  render: (args) => <DeferredCheckDemo {...args} />,
  args: { onMe: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await new Promise((resolve) => setTimeout(resolve, 200)) // 미루는 동안은 아무것도 나가지 않는다
    await expect(args.onMe).not.toHaveBeenCalled()
    await expect(canvas.getByLabelText('ready')).toHaveTextContent('false')
    await userEvent.click(canvas.getByRole('button', { name: '바깥 막이 걷혔다' }))
    await waitFor(() => expect(canvas.getByLabelText('ready')).toHaveTextContent('true'))
    await expect(args.onMe).toHaveBeenCalledTimes(1)
  },
}

export const DeferCheckNeverAsksAfterSigningOut: StoryObj<typeof DeferredCheckDemo> = {
  render: (args) => <DeferredCheckDemo {...args} />,
  args: { onMe: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '바깥 막에서 로그아웃' }))
    await new Promise((resolve) => setTimeout(resolve, 300)) // 토큰 없는 `me` 가 늦게 나가는지 지켜본다
    await expect(args.onMe).not.toHaveBeenCalled()
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

// ───────────────────────── 쓰기 때 (서버가 주소를 글을 쓸 때 받는다: me.emailRequiredToWrite) ─────────────────────────

const WRITE_SERVER: FakeAccountOptions = { emailRequired: false, emailRequiredToWrite: true }
const WRITE_TITLE = 'Register an email to post'
const KO_WRITE_TITLE = '글을 쓰려면 이메일을 등록해 주세요'

/**
 * 글쓰기 폼(뒤의 앱)이 쓰기를 보낸다: 서버는 주소가 없으면 403 `ACCOUNT.EMAIL_REQUIRED` → 컨트롤러가 붙잡고(`recover`) 막을 연다.
 * 등록이 끝나면 **같은 쓰기를 한 번 더** 보내고(`attempts` 가 늘어난다), 「나중에 하기」면 원래 403 으로 끝나 폼이 한 줄로 말한다. 쓰던 글은 어느 쪽이든 그대로다
 */
function WriteDemo({
  fake,
  korean,
  width,
  onLater,
  standAside,
}: {
  fake?: FakeAccountOptions
  korean?: boolean
  width?: number
  onLater?: () => void
  /** 계정 설정(`/account`) - 막이 걷혀 있다 */
  standAside?: boolean
}) {
  const options = useMemo(() => ({ ...WRITE_SERVER, ...fake }), [fake])
  const api = useMemo(() => createFakeAccountApi(options), [options])
  const controller = useMemo(() => createEmailRequiredController(), [])
  const labels = mergeLabels(korean ? koAuthLabels : undefined)
  const [attempts, setAttempts] = useState(0)
  const [status, setStatus] = useState<'idle' | 'declined' | 'posted'>('idle')
  const [draft, setDraft] = useState('')
  /** 서버가 받는 쓰기 호출 - 주소가 없으면 403 */
  const write = async () => {
    setAttempts((n) => n + 1)
    if ((await api.me()).emailRequiredToWrite === true)
      throw apiError('ACCOUNT.EMAIL_REQUIRED', 403)
  }
  const post = async () => {
    setStatus('idle')
    try {
      await write()
    } catch (error) {
      const recovered = await controller.recover({
        path: '/posts',
        method: 'POST',
        error: error as never,
      })
      if (!recovered) return setStatus('declined')
      await write() // 붙잡았던 호출을 그대로 한 번 더
    }
    setStatus('posted')
  }
  const gate = (
    <EmailRequiredGate
      controller={controller}
      api={api}
      accountId="acc_demo"
      labels={korean ? koAuthLabels : undefined}
      onSignOut={() => undefined}
      onDiscarded={() => undefined}
      onLater={onLater}
      standAside={standAside}
    >
      <main>
        <h1>내 노트</h1>
        <label>
          글
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <button type="button" onClick={() => void post()}>
          올리기
        </button>
        <output aria-label="status">{status}</output>
        <output aria-label="attempts">{attempts}</output>
        {status === 'declined' && <p role="status">{labels.emailRequiredDeclined}</p>}
      </main>
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

type WriteStory = StoryObj<typeof WriteDemo>

type Typist = ReturnType<typeof userEvent.setup>
const startPosting = async (canvas: ReturnType<typeof within>, userEvent: Typist) => {
  await userEvent.type(canvas.getByRole('textbox', { name: '글' }), '안녕하세요')
  await userEvent.click(canvas.getByRole('button', { name: '올리기' }))
}

/**
 * 쓰기 때 방식의 서버 + 막이 걷힌 계정 설정(`/account`): 화면이 없으니 붙잡힌 호출을 풀어 줄 사람도 없다 - 붙잡지 않고 바로 원래 403 으로 끝나
 * 구역이 이유를 말한다(단추가 진행 중에서 멈추지 않는다)
 */
export const WriteModeOnTheAccountPageDoesNotHoldTheCall: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  args: { standAside: true },
  play: async ({ canvas, userEvent }) => {
    await startPosting(canvas, userEvent)
    await waitFor(() => expect(canvas.getByLabelText('status')).toHaveTextContent('declined'), {
      timeout: 2000,
    })
    await expect(canvas.queryByRole('dialog')).toBeNull()
  },
}

/** 쓰기의 403 이 연 막 — 제목 · 본문이 쓰기용이고 「나중에 하기」(테두리)가 로그아웃 옆에 있다. 읽기용 문구는 없다 */
export const WriteLookHasNotNow: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await startPosting(canvas, userEvent)
    const screen = within(await dialog(canvas, WRITE_TITLE))
    await waitFor(() => expect(screen.getByRole('heading', { name: WRITE_TITLE })).toHaveFocus())
    await expect(screen.getByText(/You can keep reading/)).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Not now' })).toHaveAttribute(
      'data-variant',
      'secondary',
    )
    await expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Send me a code' })).toHaveAttribute(
      'data-variant',
      'primary',
    )
    await expect(canvas.queryByRole('dialog', { name: 'Add your email address' })).toBeNull()
    // 이 서버는 `emailRequired` 가 늘 false - 「주소가 생겼나」로 보니 막이 뜨자마자 접히지 않는다(탭이 다시 보일 때 서버에 다시 물어도)
    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve, 200))
    await expect(canvas.getByRole('dialog', { name: WRITE_TITLE })).toBeVisible()
  },
}

/** 「나중에 하기」 — 막이 닫히고 붙잡은 호출은 원래 403 으로 끝난다. 폼이 한 줄로 말하고, 쓰던 글은 그대로, 읽기를 계속한다 */
export const NotNowEndsTheHeldWriteAs403AndKeepsTheDraft: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  args: { onLater: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await startPosting(canvas, userEvent)
    const screen = within(await dialog(canvas, WRITE_TITLE))
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(canvas.getByLabelText('status')).toHaveTextContent('declined'))
    await expect(canvas.getByText('You can post after registering an email')).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: '글' })).toHaveValue('안녕하세요')
    await expect(canvas.getByLabelText('attempts')).toHaveTextContent('1') // 다시 보내지 않았다
    await expect(canvas.getByRole('main').closest('[inert]')).toBeNull()
    await expect(args.onLater).toHaveBeenCalledTimes(1)
  },
}

/** 등록이 끝나면 붙잡은 호출이 **같은 호출 그대로 한 번 더** 나간다 - 쓰던 글이 그대로라 올려진다 */
export const RegisteringSendsTheHeldWriteOnceMore: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await startPosting(canvas, userEvent)
    const screen = within(await dialog(canvas, WRITE_TITLE))
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
    await expect(await screen.findByText(/We sent a 6-digit code to me@example.com/)).toBeVisible()
    await userEvent.click(screen.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste(FAKE_CODE)
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(canvas.getByLabelText('status')).toHaveTextContent('posted'))
    await expect(canvas.getByLabelText('attempts')).toHaveTextContent('2') // 403 한 번 + 다시 보낸 한 번
    await expect(canvas.getByRole('textbox', { name: '글' })).toHaveValue('안녕하세요')
  },
}

/** 제공자 화면에 다녀오면 쓰던 글이 사라진다 - 떠나기 전에 한 줄로 말한다(쓰기용 모습에서만) */
export const LeavingForTheProviderWarnsTheDraftIsLost: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  args: { fake: { reauthWindowExpired: true } },
  play: async ({ canvas, userEvent }) => {
    await startPosting(canvas, userEvent)
    const screen = within(await dialog(canvas, WRITE_TITLE))
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
    await expect(await screen.findByText(/confirm once more with Kakao/)).toBeVisible()
    await expect(screen.getByText('Going to Kakao discards what you were writing.')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Confirm with Kakao' })).toBeVisible()
  },
}

/** 다른 탭에서 등록했다 - 이 서버는 `emailRequired` 가 false 라 **주소가 생겼는지**로 안다. 탭이 다시 보이면 접고 붙잡은 호출을 보낸다 */
function WriteRegisteredElsewhereDemo({ onSettled }: { onSettled: (result: boolean) => void }) {
  const [address, setAddress] = useState<string | null>(null)
  const api = useMemo(() => createFakeAccountApi(WRITE_SERVER), [])
  const controller = useMemo(() => createEmailRequiredController(), [])
  useEffect(() => {
    void controller
      .recover({ path: '/posts', method: 'POST', error: apiError('ACCOUNT.EMAIL_REQUIRED', 403) })
      .then(onSettled)
  }, [controller, onSettled])
  return (
    <>
      <button type="button" onClick={() => setAddress('me@example.com')}>
        다른 탭에서 등록 끝
      </button>
      <EmailRequiredGate
        controller={controller}
        api={{
          ...api,
          me: async () => ({
            ...(await api.me()),
            email: address,
            emailRequiredToWrite: address === null,
          }),
        }}
        accountId="acc_a"
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <AppBehind />
      </EmailRequiredGate>
    </>
  )
}

export const WriteRegisteredInAnotherTabFoldsByTheAddress: StoryObj<
  typeof WriteRegisteredElsewhereDemo
> = {
  render: (args) => <WriteRegisteredElsewhereDemo {...args} />,
  args: { onSettled: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await dialog(canvas, WRITE_TITLE)
    await userEvent.click(canvas.getByRole('button', { name: '다른 탭에서 등록 끝' }))
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(args.onSettled).toHaveBeenCalledWith(true))
  },
}

/** 로그인 직후에는 열리지 않는다(`emailRequired` 가 false) - 읽기는 그대로, 다음 단계(약관 …)는 물어도 된다 */
export const WriteServerDoesNotOpenAtSignIn: StoryObj<typeof OpensFromMeDemo> = {
  render: (args) => <OpensFromMeDemo {...args} />,
  args: { fake: { emailRequiredToWrite: true } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByLabelText('ready')).toHaveTextContent('true'))
    await expect(canvas.queryByRole('dialog')).toBeNull()
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
  },
}

/**
 * 쓰기 전 확인(`useEmailBeforeWrite`) + 댓글 칸 위의 띠(`EmailWriteNotice`). 띠는 막지 않는다 - 입력은 그대로 쓸 수 있고 단추가 막을 연다.
 * 「글쓰기」 단추는 먼저 `ensure()` 를 불러 false 면 쓰기 화면으로 가지 않는다(등록한 뒤 다시 누른다). 등록이 끝나면 띠가 사라진다
 */
function BeforeWriteDemo({ width }: { width?: number }) {
  const api = useMemo(() => createFakeAccountApi(WRITE_SERVER), [])
  const controller = useMemo(() => createEmailRequiredController(), [])
  const { ensure } = useEmailBeforeWrite(controller)
  const [opened, setOpened] = useState(false)
  const body = (
    <EmailRequiredGate
      controller={controller}
      api={api}
      accountId="acc_demo"
      onSignOut={() => undefined}
      onDiscarded={() => undefined}
    >
      <main>
        <h1>게시판</h1>
        <button
          type="button"
          onClick={() => {
            if (!ensure()) return
            setOpened(true)
          }}
        >
          글쓰기
        </button>
        {opened && <p role="status">글쓰기 화면</p>}
        <EmailWriteNotice controller={controller} />
        <label>
          댓글
          <textarea />
        </label>
      </main>
    </EmailRequiredGate>
  )
  return width ? (
    <div style={{ width, height: 700, transform: 'translateZ(0)', overflow: 'auto' }}>{body}</div>
  ) : (
    body
  )
}

export const NoticeBandAboveTheCommentBoxDoesNotBlock: StoryObj<typeof BeforeWriteDemo> = {
  render: (args) => <BeforeWriteDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    const band = await canvas.findByText('Register an email to start posting')
    await expect(band).toBeVisible()
    const action = canvas.getByRole('button', { name: 'Register email' })
    await expect(action).toHaveAttribute('data-variant', 'secondary')
    // 막지 않는다: 댓글 칸에 그대로 쓴다
    await userEvent.type(canvas.getByRole('textbox', { name: '댓글' }), '먼저 써 볼게요')
    await expect(canvas.getByRole('textbox', { name: '댓글' })).toHaveValue('먼저 써 볼게요')
    await expect(canvas.queryByRole('dialog')).toBeNull()
    // 단추는 쓰기용 막을 연다 - 「나중에 하기」로 닫으면 띠는 그대로, 쓰던 댓글도 그대로
    await userEvent.click(action)
    const screen = within(await dialog(canvas, WRITE_TITLE))
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(canvas.getByText('Register an email to start posting')).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: '댓글' })).toHaveValue('먼저 써 볼게요')
  },
}

/** 「글쓰기」 단추가 쓰기 화면으로 가기 **전에** 묻는다 - false 면 가지 않고, 등록한 뒤 다시 누르면 간다(띠도 사라진다) */
export const WriteButtonAsksBeforeGoingToTheWritingScreen: StoryObj<typeof BeforeWriteDemo> = {
  render: (args) => <BeforeWriteDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '글쓰기' }))
    const screen = within(await dialog(canvas, WRITE_TITLE))
    await expect(canvas.queryByText('글쓰기 화면')).toBeNull() // 아직 쓰기 화면으로 가지 않았다
    await userEvent.type(screen.getByRole('textbox', { name: /^Email/ }), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
    await screen.findByText(/We sent a 6-digit code/)
    await userEvent.click(screen.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste(FAKE_CODE)
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(canvas.queryByText('Register an email to start posting')).toBeNull() // 띠가 사라졌다
    await userEvent.click(canvas.getByRole('button', { name: '글쓰기' }))
    await expect(await canvas.findByText('글쓰기 화면')).toBeVisible()
  },
}

/** 320px — 띠가 줄을 바꿔 단추가 아래로 내려가고 가로로 밀리지 않는다 */
export const NoticeBandNarrow320: StoryObj<typeof BeforeWriteDemo> = {
  render: (args) => <BeforeWriteDemo {...args} />,
  args: { width: 320 },
  play: async ({ canvas }) => {
    const band = (await canvas.findByText('Register an email to start posting')).parentElement!
    await expect(canvas.getByRole('button', { name: 'Register email' })).toBeVisible()
    await waitFor(() => expect(band.scrollWidth).toBeLessThanOrEqual(band.clientWidth))
  },
}

/** 버리기 확인 — 아이디를 정한 계정이면 「아이디 … 도 함께 사라지고 다시 쓸 수 없어요」 한 줄이 더 붙는다 */
export const DiscardConfirmationNamesTheUsername: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  args: { fake: { loginId: { value: 'Sumin.Kim' } } },
  play: async ({ canvas, userEvent }) => {
    await startPosting(canvas, userEvent)
    const screen = within(await dialog(canvas, WRITE_TITLE))
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete this account and go to sign-in' }),
    )
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'Delete this account?',
    })
    await expect(
      within(confirm).getByText('The username sumin.kim goes with it and can never be used again.'),
    ).toBeVisible()
  },
}

/** 아이디가 없는 서버(키 없음)에서는 그 줄이 없다 */
export const DiscardConfirmationHasNoUsernameLineWithoutOne: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await startPosting(canvas, userEvent)
    const screen = within(await dialog(canvas, WRITE_TITLE))
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete this account and go to sign-in' }),
    )
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'Delete this account?',
    })
    await expect(within(confirm).queryByText(/The username/)).toBeNull()
  },
}

/** 한국어 */
export const WriteLookKorean: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  args: { korean: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: '글' }), '안녕하세요')
    await userEvent.click(canvas.getByRole('button', { name: '올리기' }))
    const screen = within(await dialog(canvas, KO_WRITE_TITLE))
    await expect(
      screen.getByText(
        '읽기는 지금처럼 할 수 있어요. 글 · 댓글 · 반응을 남기려면 이메일이 필요해요. 다른 사람에게는 보이지 않아요.',
      ),
    ).toBeVisible()
    await expect(screen.getByRole('button', { name: '나중에 하기' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: '나중에 하기' }))
    await expect(await canvas.findByText('이메일을 등록한 뒤에 쓸 수 있어요')).toBeVisible()
  },
}

const writeNoHorizontalScroll = async (canvas: ReturnType<typeof within>) => {
  const screen = await dialog(canvas, KO_WRITE_TITLE)
  await waitFor(() => expect(screen.scrollWidth).toBeLessThanOrEqual(screen.clientWidth))
  // 「나중에 하기」와 「로그아웃」이 칸 안에 들어온다
  const later = within(screen).getByRole('button', { name: '나중에 하기' })
  await expect(later.getBoundingClientRect().right).toBeLessThanOrEqual(
    screen.getBoundingClientRect().right,
  )
}

/** 320px · 쓰기 모습 */
export const WriteLookNarrow320: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  args: { width: 320, korean: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: '글' }), '안녕하세요')
    await userEvent.click(canvas.getByRole('button', { name: '올리기' }))
    await writeNoHorizontalScroll(canvas)
  },
}

/** 375px · 쓰기 모습 */
export const WriteLookNarrow375: WriteStory = {
  render: (args) => <WriteDemo {...args} />,
  args: { width: 375, korean: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: '글' }), '안녕하세요')
    await userEvent.click(canvas.getByRole('button', { name: '올리기' }))
    await writeNoHorizontalScroll(canvas)
  },
}
