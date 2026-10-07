import type { Meta, StoryObj } from '@storybook/react-vite'
import { useId, useState, type FormEvent } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { Button, Checkbox, FormProblems, useSubmitAttempt } from '@skeleton/ui'
import { ConsentBanner } from './ConsentBanner'
import { createConsentStore, type StorageLike } from './consentStore'

/**
 * 동의 배너 — 방문자가 아직 고르지 않았을 때만 화면 아래에 뜬다. **「모두 거부」 와 「모두 허용」 은 같은 무게**, 「선택」 은 범주별 스위치(필수 범주는 끌 수 없다).
 * 선택은 `createConsentStore` 가 `localStorage` 에 저장하고 `onChange` · `store.has('analytics')` 로 앱이 자기 분석 코드를 켠다 — **이 패키지에 추적 코드는 없다**.
 * 서버 렌더에는 그리지 않는다(선택을 모르니 이미 고른 사람에게 깜박이지 않게). 푸터의 「쿠키 설정」 은 `store.reset()`.
 */
const categories = [
  {
    id: 'necessary',
    label: 'Necessary',
    description: 'Keeps you signed in and the site working.',
    required: true,
  },
  { id: 'analytics', label: 'Analytics', description: 'Anonymous visit counts.' },
]

function memory(): StorageLike {
  const data: Record<string, string> = {}
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => void (data[key] = value),
    removeItem: (key) => void delete data[key],
  }
}
/** 가입 폼 모양의 긴 페이지 — 제출 버튼이 화면 맨 아래쯤에 온다(배너가 가리기 쉬운 자리) */
function FormPage({ reserveSpace }: { reserveSpace?: boolean }) {
  const uid = useId()
  const consent = `${uid}-consent`
  const [agreed, setAgreed] = useState(false)
  const attempt = useSubmitAttempt()
  const store = useState(() =>
    createConsentStore({ categories: ['necessary', 'analytics'], version: '1', storage: memory() }),
  )[0]
  const problems = agreed
    ? []
    : [{ key: 'consent', message: 'Agree to the required terms', target: consent }]
  function submit(event: FormEvent) {
    event.preventDefault()
    if (problems.length > 0) attempt.fail(consent)
  }
  return (
    <div>
      <form
        noValidate
        onSubmit={submit}
        aria-label="Sign up"
        style={{ display: 'grid', gap: 16, minHeight: '100svh', alignContent: 'end' }}
      >
        <Checkbox
          id={consent}
          label="I agree to the terms (required)"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          error={attempt.attempted && !agreed ? 'Required' : undefined}
        />
        <FormProblems title="Check these" problems={attempt.attempted ? problems : []} />
        <Button type="submit">Create account</Button>
      </form>
      <ConsentBanner store={store} categories={categories} reserveSpace={reserveSpace} />
    </div>
  )
}

/** 요소 한가운데에서 가장 위에 보이는 것이 그 요소(또는 그 안)인가 — 가려지지 않았다 */
const topAtCentre = (element: Element) => {
  const box = element.getBoundingClientRect()
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
  return !!hit && element.contains(hit)
}

const onChange = fn()
const meta = {
  title: 'Packages/ConsentBanner',
  component: ConsentBanner,
  args: {
    categories,
    store: createConsentStore({
      categories: ['necessary', 'analytics'],
      version: '1',
      storage: memory(),
    }),
  },
  beforeEach: () => onChange.mockClear(),
  render: () => {
    const store = createConsentStore({
      categories: ['necessary', 'analytics'],
      version: '1',
      storage: memory(),
      onChange,
    })
    return (
      <div style={{ minHeight: '16rem' }}>
        <p>Page content behind the banner.</p>
        <ConsentBanner
          store={store}
          categories={categories}
          policyLink={<a href="#privacy">Privacy policy</a>}
        />
      </div>
    )
  },
} satisfies Meta<typeof ConsentBanner>
export default meta
type Story = StoryObj<typeof meta>

export const RejectAllIsAsEasyAsAcceptAll: Story = {
  play: async ({ canvas, userEvent }) => {
    const banner = await canvas.findByRole('region', { name: 'Cookies and privacy' })
    await expect(banner).toBeVisible()
    const reject = canvas.getByRole('button', { name: 'Reject all' })
    const accept = canvas.getByRole('button', { name: 'Accept all' })
    // 같은 무게: 같은 모양의 버튼
    await expect(reject.getAttribute('data-variant')).toBe(accept.getAttribute('data-variant'))
    await userEvent.click(reject)
    await waitFor(() =>
      expect(canvas.queryByRole('region', { name: 'Cookies and privacy' })).toBeNull(),
    )
    await expect(onChange).toHaveBeenCalledTimes(1)
    await expect(onChange.mock.calls[0][0]).toMatchObject({
      status: 'decided',
      choices: { necessary: true, analytics: false },
    })
  },
}

export const AcceptAll: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Accept all' }))
    await expect(onChange.mock.calls[0][0]).toMatchObject({
      choices: { necessary: true, analytics: true },
    })
  },
}

export const ChooseCategories: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Choose' }))
    const necessary = canvas.getByRole('switch', { name: /Necessary/ })
    await expect(necessary).toBeChecked()
    await expect(necessary).toBeDisabled()
    const analytics = canvas.getByRole('switch', { name: 'Analytics' })
    await expect(analytics).not.toBeChecked()
    await userEvent.click(analytics)
    await userEvent.click(canvas.getByRole('button', { name: 'Save choices' }))
    await expect(onChange.mock.calls[0][0]).toMatchObject({
      choices: { necessary: true, analytics: true },
    })
    await waitFor(() => expect(canvas.queryByRole('region')).toBeNull())
  },
}

export const AlreadyDecidedShowsNothing: Story = {
  render: () => {
    const store = createConsentStore({
      categories: ['necessary', 'analytics'],
      version: '1',
      storage: memory(),
    })
    store.rejectAll()
    return <ConsentBanner store={store} categories={categories} />
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region')).toBeNull()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('region', { name: 'Cookies and privacy' })).toBeVisible()
  },
}

export const NeverCoversTheSubmitButtonOrTheError: Story = {
  render: () => <FormPage />,
  play: async ({ canvas, userEvent }) => {
    const banner = await canvas.findByRole('region', { name: 'Cookies and privacy' })
    // 맨 끝까지 스크롤하면 제출 버튼이 배너 위에 온다
    window.scrollTo(0, document.documentElement.scrollHeight)
    const submit = canvas.getByRole('button', { name: 'Create account' })
    await waitFor(() => expect(topAtCentre(submit)).toBe(true))
    await expect(submit.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      banner.getBoundingClientRect().top,
    )
    // 비운 자리가 배너 높이만큼이다
    await expect(parseFloat(getComputedStyle(document.body).paddingBottom)).toBeGreaterThanOrEqual(
      banner.getBoundingClientRect().height,
    )
    // 필수에 동의하지 않고 제출 — 오류 문구와 요약도 배너에 가려지지 않는다
    await userEvent.click(submit)
    const error = await canvas.findByText('Required')
    const summary = await canvas.findByRole('button', { name: 'Agree to the required terms' })
    await waitFor(() => {
      expect(topAtCentre(error)).toBe(true)
      expect(topAtCentre(summary)).toBe(true)
      expect(topAtCentre(canvas.getByRole('checkbox'))).toBe(true)
      expect(topAtCentre(canvas.getByRole('button', { name: 'Create account' }))).toBe(true)
    })
  },
}

export const FocusStaysAboveTheBanner: Story = {
  render: () => <FormPage />,
  play: async ({ canvas }) => {
    const banner = await canvas.findByRole('region', { name: 'Cookies and privacy' })
    // `scroll-padding-bottom` 덕에 키보드로 맨 아래 버튼에 가면 배너 위에 보인다
    window.scrollTo(0, 0)
    const submit = canvas.getByRole('button', { name: 'Create account' })
    submit.focus()
    await waitFor(() => expect(topAtCentre(submit)).toBe(true))
    // 비운 높이 = 배너 높이 + 화면 아래에서 띄운 간격
    await expect(getComputedStyle(document.documentElement).scrollPaddingBottom).toBe(
      `${Math.ceil(banner.getBoundingClientRect().height + parseFloat(getComputedStyle(banner).bottom))}px`,
    )
  },
}

export const ReservedSpaceIsReleasedWhenTheBannerGoes: Story = {
  render: () => <FormPage />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Reject all' }))
    await waitFor(() => expect(canvas.queryByRole('region')).toBeNull())
    await expect(document.body.style.paddingBottom).toBe('')
    await expect(document.documentElement.style.scrollPaddingBottom).toBe('')
  },
}

/** 대조군 — 자리를 비우지 않으면(`reserveSpace={false}`) 같은 페이지에서 배너가 제출 버튼을 가린다. 위 이야기들의 검사가 실제로 가림을 잡는다는 증거 */
export const WithoutReservingTheBannerCoversTheButton: Story = {
  render: () => <FormPage reserveSpace={false} />,
  play: async ({ canvas }) => {
    await canvas.findByRole('region', { name: 'Cookies and privacy' })
    window.scrollTo(0, document.documentElement.scrollHeight)
    const submit = canvas.getByRole('button', { name: 'Create account' })
    await expect(topAtCentre(submit)).toBe(false)
  },
}
