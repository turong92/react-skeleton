import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
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
