import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Breadcrumbs } from './Breadcrumbs'

/**
 * 경로 표시 — `nav` + 순서 목록, 마지막은 현재 페이지(`aria-current="page"`, 링크 아님). `nav` 이름(`label`)은 필수라 화면 언어를 앱이 정한다.
 * 라우터 링크가 필요하면 `renderLink` 로 그린다. 상세 화면의 `PageHeader` 위에 둔다.
 */
const meta = {
  title: 'UI/Breadcrumbs',
  component: Breadcrumbs,
  args: {
    label: 'Breadcrumb',
    items: [
      { label: 'Home', href: '/' },
      { label: 'Notes', href: '/notes' },
      { label: 'Weekly sync' },
    ],
  },
} satisfies Meta<typeof Breadcrumbs>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const nav = canvas.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(nav).toBeVisible()
    await expect(canvas.getAllByRole('link')).toHaveLength(2)
    await expect(canvas.getByText('Weekly sync')).toHaveAttribute('aria-current', 'page')
    // 링크는 키보드로 닿는다
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'Home' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'Notes' })).toHaveFocus()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
  },
}
