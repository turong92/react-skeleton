import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { createLoginIdRequiredController } from '../loginIdRequired'
import { koAuthLabels } from '../screens/labels.ko'
import { LoginIdGate } from '../screens/LoginIdGate'
import { apiError, createFakeAccountApi, type FakeAccountOptions } from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 아이디 정하기 강제 — 아이디를 켠 앱에서 아이디가 없는 계정(소셜 첫 로그인 · 아이디를 켜기 전부터 있던 계정)이 로그인하면 앱 대신 전면 화면이 덮는다(`LoginIdGate`).
 * 아이디 칸(실시간 확인) → 채워진 단추 「이 아이디로 정하기」 → **확인 대화상자**(정한 뒤에는 바꿀 수 없다) → 정하면 막혔던 호출이 다시 나가 가던 자리에서 이어진다.
 * 떠나는 길이 늘 있다: 로그아웃 · 계정 설정 · (이메일 필수를 켠 앱의 주소 없는 계정이면) 「이미 계정이 있나요?」.
 * 이메일 막(`EmailRequiredGate`) 바깥에 둔다 — 한 번에 하나, 순서는 아이디 → 이메일 → 약관.
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
  korean?: boolean
  /** 앱이 보낸 호출이 403 으로 막혔다가 풀렸다(true) · 끝났다(false) */
  onHeldCall?: (result: boolean) => void
  onChosen?: () => void
  onSignOut?: () => void
  onDiscarded?: (provider?: string) => void
  /** 화면 폭(px) — `transform` 이 `position: fixed` 의 기준을 이 칸으로 바꿔 작은 폭에서의 모습을 그대로 본다 */
  width?: number
}

function Demo({
  fake,
  standAside,
  korean,
  onHeldCall,
  onChosen,
  onSignOut = () => undefined,
  onDiscarded = () => undefined,
  width,
}: DemoProps) {
  const api = useMemo(() => createFakeAccountApi({ loginId: {}, ...fake }), [fake])
  const controller = useMemo(() => createLoginIdRequiredController(), [])
  // 앱이 보낸 쓰기 호출이 403 으로 막혔다 — 컨트롤러가 붙잡고 있다가 정하고 나면 풀어 준다
  useEffect(() => {
    void controller
      .recover({
        path: '/notes',
        method: 'POST',
        error: apiError('ACCOUNT.LOGIN_ID_REQUIRED', 403),
      })
      .then((result) => onHeldCall?.(result))
  }, [controller, onHeldCall])
  const gate = (
    <LoginIdGate
      controller={controller}
      api={api}
      accountId="acc_demo"
      labels={korean ? koAuthLabels : undefined}
      standAside={standAside}
      onSignOut={onSignOut}
      onDiscarded={onDiscarded}
      onChosen={onChosen}
    >
      <AppBehind />
    </LoginIdGate>
  )
  return width ? (
    <div
      style={{
        width,
        height: 760,
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
  title: 'Patterns/Auth/Login id required',
  component: Demo,
  decorators: [withRouter],
  args: {
    onHeldCall: fn(),
    onChosen: fn(),
    onSignOut: fn(),
    onDiscarded: fn(),
  },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof Demo>

const dialog = (canvas: ReturnType<typeof within>, name = 'Choose your username') =>
  canvas.findByRole('dialog', { name })

const SUBMIT = 'Use this username'

/** 빈 칸에서 시작 — 앱은 만질 수 없고, 비어 있으면 이유를 말하고 그 칸으로 간다(단추는 늘 눌린다) */
export const EmptyField: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await expect(canvas.getByText('앱 화면').closest('[inert]')).not.toBeNull()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Choose your username' })).toHaveFocus(),
    )
    await expect(screen.getByText(/The name of your account that never changes/)).toBeVisible()
    // 칸은 라벨로 이어진다 — 안내 한 줄도 칸에 붙어 읽힌다
    const input = screen.getByRole('textbox', { name: /^Username/ })
    await expect(input).toHaveAccessibleDescription(/4–20 characters/)
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }))
    await expect(await screen.findByRole('button', { name: 'Enter a username' })).toBeVisible()
    await waitFor(() => expect(input).toHaveFocus())
    await expect(args.onChosen).not.toHaveBeenCalled()
  },
}

/** 정하기까지 끝까지 — 입력하면 상태 줄이 글자로 말하고, 누르면 확인 대화상자가 묻고, 「정하기」로 낸다. 붙잡았던 호출이 풀리고 앱이 살아난다 */
export const ChooseThenConfirm: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    const input = screen.getByRole('textbox', { name: /^Username/ })
    await userEvent.type(input, 'Sumin.Kim')
    await expect(await screen.findByText(/This username is available/)).toBeVisible()
    await expect(screen.getByText(/It will be saved as sumin.kim/)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }))
    // 정하기 전에 한 번 묻는다 — 서버에는 아직 안 갔다
    const confirm = await within(document.body).findByRole('dialog', { name: 'Use sumin.kim?' })
    await expect(within(confirm).getByText('You cannot change it afterwards.')).toBeVisible()
    await expect(args.onChosen).not.toHaveBeenCalled()
    // 처음 포커스는 안전한 쪽(다시 입력)
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Edit' })).toHaveFocus())
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(canvas.queryByRole('dialog', { name: 'Choose your username' })).toBeNull(),
    )
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
    await expect(args.onChosen).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(args.onHeldCall).toHaveBeenCalledWith(true))
  },
}

/** 키보드만으로 — 칸에서 Enter 가 확인 대화상자를 연다. 「다시 입력」은 칸으로 돌아가 쓴 값이 남아 있다 */
export const KeyboardAndEditAgain: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    const input = screen.getByRole('textbox', { name: /^Username/ })
    await userEvent.type(input, 'sumin.kim')
    await screen.findByText(/This username is available/)
    await userEvent.keyboard('{Enter}')
    const confirm = await within(document.body).findByRole('dialog', { name: 'Use sumin.kim?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Edit' }))
    await waitFor(() =>
      expect(within(document.body).queryByRole('dialog', { name: 'Use sumin.kim?' })).toBeNull(),
    )
    await expect(input).toHaveValue('sumin.kim')
    await expect(args.onChosen).not.toHaveBeenCalled()
    await expect(args.onChosen).not.toHaveBeenCalled()
  },
}

/** 형식이 틀린 값은 확인까지 가지 않는다 — 칸 옆 오류와 요약이 같은 말을 한다 */
export const BadShapeNeverReachesTheConfirmation: Story = {
  play: async ({ canvas, userEvent }) => {
    const screen = within(await dialog(canvas))
    const input = screen.getByRole('textbox', { name: /^Username/ })
    await userEvent.type(input, 'a@b')
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }))
    await expect(
      (await screen.findAllByText('Use only letters, numbers, periods, hyphens and underscores'))
        .length,
    ).toBeGreaterThan(0)
    await expect(within(document.body).queryByRole('dialog', { name: /^Use / })).toBeNull()
  },
}

/** 실시간 확인에서는 비어 있었는데 내는 순간 남이 가져갔다(409 `LOGIN_ID_TAKEN`) — 대화상자가 닫히고 칸 옆에 우리 문구, 막은 그대로 */
export const TakenWhileConfirming409: Story = {
  args: { fake: { loginId: { takenOnConfirm: ['race.winner'] } } },
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    const input = screen.getByRole('textbox', { name: /^Username/ })
    await userEvent.type(input, 'race.winner')
    await screen.findByText(/This username is available/)
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }))
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'Use race.winner?',
    })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(within(document.body).queryByRole('dialog', { name: 'Use race.winner?' })).toBeNull(),
    )
    await expect(
      (await screen.findAllByText('This username is taken or not available')).length,
    ).toBeGreaterThan(0)
    await waitFor(() => expect(input).toHaveFocus())
    await expect(args.onChosen).not.toHaveBeenCalled()
    await expect(canvas.getByText('앱 화면').closest('[inert]')).not.toBeNull()
    // 고쳐 쓰면 오류가 사라진다
    await userEvent.type(input, '2')
    await waitFor(() =>
      expect(screen.queryByText('This username is taken or not available')).toBeNull(),
    )
  },
}

/** 이미 쓰는 아이디는 내기 전에 실시간 확인이 말한다 — 낼 수 없다 */
export const TakenIsToldBeforeSubmitting: Story = {
  args: { fake: { loginId: { taken: ['sumin.kim'] } } },
  play: async ({ canvas, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.type(screen.getByRole('textbox', { name: /^Username/ }), 'sumin.kim')
    await userEvent.tab() // 칸을 벗어나면 확인 결과(쓸 수 없다)가 칸 옆 오류로 나온다
    await expect(
      (await screen.findAllByText('This username is taken or not available')).length,
    ).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }))
    await expect(within(document.body).queryByRole('dialog', { name: /^Use / })).toBeNull()
  },
}

/** 다른 탭에서 이미 정했다(409 `LOGIN_ID_ALREADY_SET`) — `me` 를 다시 읽고 막을 접고, 붙잡은 호출은 풀린다 */
function ChosenElsewhereDemo(props: Pick<DemoProps, 'onHeldCall' | 'onChosen'>) {
  const base = useMemo(() => createFakeAccountApi({ loginId: {} }), [])
  const [elsewhere, setElsewhere] = useState(false)
  const api = useMemo(
    () => ({
      ...base,
      setLoginId: async () => {
        setElsewhere(true)
        throw apiError('ACCOUNT.LOGIN_ID_ALREADY_SET', 409)
      },
      me: async () => ({ ...(await base.me()), loginId: elsewhere ? 'other.tab' : null }),
    }),
    [base, elsewhere],
  )
  const controller = useMemo(() => createLoginIdRequiredController(), [])
  const { onHeldCall } = props
  useEffect(() => {
    void controller
      .recover({
        path: '/notes',
        method: 'POST',
        error: apiError('ACCOUNT.LOGIN_ID_REQUIRED', 403),
      })
      .then((result) => onHeldCall?.(result))
  }, [controller, onHeldCall])
  return (
    <LoginIdGate
      controller={controller}
      api={api}
      accountId="acc_demo"
      onSignOut={() => undefined}
      onDiscarded={() => undefined}
    >
      <AppBehind />
    </LoginIdGate>
  )
}

export const ChosenInAnotherTab409: StoryObj<typeof ChosenElsewhereDemo> = {
  render: (args) => <ChosenElsewhereDemo {...args} />,
  args: { onHeldCall: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await userEvent.type(screen.getByRole('textbox', { name: /^Username/ }), 'sumin.kim')
    await screen.findByText(/This username is available/)
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }))
    const confirm = await within(document.body).findByRole('dialog', { name: 'Use sumin.kim?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
    await waitFor(() => expect(args.onHeldCall).toHaveBeenCalledWith(true))
  },
}

/** 이메일 필수를 켠 앱의 주소 없는 계정 — 아이디를 태우기 전에 「이미 계정이 있나요?」로 껍데기 계정을 치울 수 있다. 확인 문구에 아이디 줄은 없다(아직 없다) */
export const DiscardPathForAnAccountWithoutAnAddress: Story = {
  args: { fake: { emailRequired: true } },
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    await expect(
      await screen.findByRole('heading', { name: 'Already have an account?' }),
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete this account and go to sign-in' }),
    )
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'Delete this account?',
    })
    await expect(within(confirm).queryByText(/username/i)).toBeNull()
    await expect(args.onDiscarded).not.toHaveBeenCalled() // 눌렀다고 바로 지우지 않는다
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete and go to sign-in' }))
    await waitFor(() => expect(args.onDiscarded).toHaveBeenCalledWith('kakao'))
  },
}

/** 주소가 있는 계정(또는 이메일을 받지 않는 앱)에는 그 길이 없다 — 막다른 길이 아니다: 로그아웃 · 계정 설정 */
export const NoDiscardPathWhenThereIsNothingToDiscard: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const screen = within(await dialog(canvas))
    // 정적이 아닌 `me` 읽기가 끝난 뒤에도 그 조각은 없다
    await waitFor(() => expect(canvas.getByText('앱 화면').closest('[inert]')).not.toBeNull())
    await expect(screen.queryByRole('heading', { name: 'Already have an account?' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledTimes(1)
  },
}

/** 떠나는 길은 눌리게 보인다 — 로그아웃은 테두리 단추, 계정 설정은 밑줄 링크(`/account`) */
export const WaysOutLookPressable: Story = {
  play: async ({ canvas }) => {
    const screen = within(await dialog(canvas))
    const link = screen.getByRole('link', { name: 'Account settings' })
    await expect(link).toHaveAttribute('href', '/account')
    await expect(getComputedStyle(link).textDecorationLine).toBe('underline')
    const signOut = screen.getByRole('button', { name: 'Sign out' })
    await expect(signOut).toHaveAttribute('data-variant', 'secondary')
    // 주 행동은 채워진 단추 하나
    await expect(screen.getByRole('button', { name: SUBMIT })).toHaveAttribute(
      'data-variant',
      'primary',
    )
  },
}

/** 계정 설정(`/account`)에서는 막이 걷힌다 — 앱 화면이 살아 있다 */
export const StandsAsideOnTheAccountPage: Story = {
  args: { standAside: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('앱 화면')).toBeVisible()
    await expect(canvas.queryByRole('dialog')).toBeNull()
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
  },
}

/** 아이디가 이미 있는 계정 · 아이디를 끈 서버(`me` 에 키가 없다)는 막이 열리지 않는다 */
export const HasLoginIdLeavesTheAppAlone: Story = {
  args: { fake: { loginId: { value: 'sumin.kim' } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('앱 화면')).toBeVisible()
    await expect(canvas.queryByRole('dialog')).toBeNull()
    await expect(canvas.getByText('앱 화면').closest('[inert]')).toBeNull()
  },
}

/** 한국어 — 확인 문구까지 */
export const Korean: Story = {
  args: { korean: true },
  play: async ({ canvas, userEvent }) => {
    const screen = within(await dialog(canvas, '아이디를 정해 주세요'))
    await expect(
      screen.getByText(
        '로그인할 때와 문의할 때 쓰는, 바뀌지 않는 내 계정 이름이에요. 다른 사람에게는 보이지 않아요.',
      ),
    ).toBeVisible()
    await userEvent.type(screen.getByRole('textbox', { name: /^아이디/ }), 'Sumin.Kim')
    await screen.findByText(/쓸 수 있는 아이디예요/)
    await userEvent.click(screen.getByRole('button', { name: '이 아이디로 정하기' }))
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'sumin.kim (으)로 정할까요?',
    })
    await expect(within(confirm).getByText('정한 뒤에는 바꿀 수 없어요.')).toBeVisible()
    await expect(within(confirm).getByRole('button', { name: '정하기' })).toBeVisible()
    await expect(within(confirm).getByRole('button', { name: '다시 입력' })).toBeVisible()
    await expect(screen.getByRole('link', { name: '계정 설정' })).toBeVisible()
    await expect(screen.getByRole('button', { name: '로그아웃' })).toBeVisible()
  },
}

const noHorizontalScroll = async (canvas: ReturnType<typeof within>) => {
  const screen = await dialog(canvas, '아이디를 정해 주세요')
  await waitFor(() => expect(screen.scrollWidth).toBeLessThanOrEqual(screen.clientWidth))
}

/** 320px — 긴 아이디를 넣어도 가로로 밀리지 않고, 확인 대화상자도 화면 안에 있다 */
export const Narrow320: Story = {
  args: { width: 320, korean: true, fake: { emailRequired: true } },
  play: async ({ canvas, userEvent }) => {
    await noHorizontalScroll(canvas)
    const screen = within(await dialog(canvas, '아이디를 정해 주세요'))
    await userEvent.type(
      screen.getByRole('textbox', { name: /^아이디/ }),
      'a-very-long-name.for_phones',
    )
    await userEvent.clear(screen.getByRole('textbox', { name: /^아이디/ }))
    await userEvent.type(screen.getByRole('textbox', { name: /^아이디/ }), 'long.name-for_phone9')
    await screen.findByText(/쓸 수 있는 아이디예요/)
    await noHorizontalScroll(canvas)
    await userEvent.click(screen.getByRole('button', { name: '이 아이디로 정하기' }))
    const confirm = await within(document.body).findByRole('dialog', {
      name: 'long.name-for_phone9 (으)로 정할까요?',
    })
    await expect(confirm.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
  },
}

/** 375px */
export const Narrow375: Story = {
  args: { width: 375, korean: true, fake: { emailRequired: true } },
  play: async ({ canvas }) => {
    await noHorizontalScroll(canvas)
  },
}
