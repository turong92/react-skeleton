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
