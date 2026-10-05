import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Button } from '../Button/Button'
import { AppShell } from './AppShell'

/**
 * 헤더(브랜드 · 내비 · 액션) + 본문 + 선택 푸터. 라우터를 모른다 — 링크는 `brand` · `nav` 로 넘긴다(앱이 `<Link>` 를 넣는다).
 * 화면마다 한 번, 루트 레이아웃에서만 쓴다.
 */
const meta = {
  title: 'UI/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: {
    brand: (
      <a href="#home">
        <strong>my-app</strong>
      </a>
    ),
    nav: (
      <>
        <a href="#projects">Projects</a>
        <a href="#settings">Settings</a>
      </>
    ),
    actions: (
      <Button size="sm" variant="ghost">
        Sign out
      </Button>
    ),
    children: <p>Page content goes here.</p>,
  },
} satisfies Meta<typeof AppShell>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('banner')).toBeVisible()
    await expect(canvas.getByRole('navigation')).toBeVisible()
    await expect(canvas.getByRole('main')).toHaveTextContent('Page content goes here.')
    await expect(canvas.queryByRole('contentinfo')).toBeNull()
    // 헤더의 순서: 브랜드 → 내비 → 액션
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'my-app' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'Projects' })).toHaveFocus()
  },
}

export const WithFooter: Story = {
  args: { footer: <small>© 2026 My App</small> },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('contentinfo')).toHaveTextContent('© 2026 My App')
  },
}

export const LongNav: Story = {
  args: {
    nav: Array.from({ length: 8 }, (_, i) => <a key={i} href={`#n${i}`}>{`Section ${i + 1}`}</a>),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('link').length).toBeGreaterThan(8)
    await expect(canvas.getByRole('main')).toBeVisible()
  },
}

/** react-router 의 `NavLink` 는 현재 쪽 링크에 `aria-current="page"` 를 단다 — 헤더가 그것으로 현재 위치를 보인다 */
export const ActiveLink: Story = {
  args: {
    nav: (
      <>
        <a href="#projects" aria-current="page">
          Projects
        </a>
        <a href="#settings">Settings</a>
      </>
    ),
  },
  play: async ({ canvas }) => {
    const active = canvas.getByRole('link', { name: 'Projects' })
    const other = canvas.getByRole('link', { name: 'Settings' })
    await expect(active).toHaveAttribute('aria-current', 'page')
    // 현재 쪽 링크는 바탕이 깔리고 글자가 더 진하다
    await expect(getComputedStyle(active).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    await expect(getComputedStyle(other).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    await expect(getComputedStyle(active).color).not.toBe(getComputedStyle(other).color)
  },
}

/** 좁은 화면 — 브랜드 · 액션이 첫 줄, 내비가 둘째 줄(가로 스크롤). 가로로 넘치지 않는다 */
export const NarrowViewport: Story = {
  args: {
    nav: Array.from({ length: 6 }, (_, i) => <a key={i} href={`#n${i}`}>{`Section ${i + 1}`}</a>),
  },
  render: (args) => (
    <div style={{ width: '20rem' }} data-testid="narrow">
      <AppShell {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const wrapper = canvasElement.querySelector<HTMLElement>('[data-testid="narrow"]')!
    await expect(wrapper.scrollWidth).toBeLessThanOrEqual(wrapper.clientWidth)
    const brand = canvas.getByRole('link', { name: 'my-app' }).getBoundingClientRect()
    const nav = canvas.getByRole('navigation').getBoundingClientRect()
    await expect(nav.top).toBeGreaterThanOrEqual(brand.bottom) // 내비가 아래 줄
    await expect(canvas.getByRole('button', { name: 'Sign out' })).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: ActiveLink.args,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}
