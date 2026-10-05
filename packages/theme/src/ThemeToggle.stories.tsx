import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { setTheme, useTheme } from './theme'
import { ThemeToggle } from './ThemeToggle'

/**
 * 누를 때마다 system → light → dark. 고른 값은 localStorage 에 저장되고 `<html data-theme>` 에 달린다 — 화면 전체 색이 바뀐다.
 * 앱은 시작할 때 `initTheme()` 을 한 번 부른다. 이 스토리집의 도구 모음 테마 스위치도 같은 속성을 쓴다.
 */
function Current() {
  return <output aria-label="Current theme">{useTheme()}</output>
}

const meta = {
  title: 'Packages/theme/ThemeToggle',
  component: ThemeToggle,
  beforeEach: () => {
    setTheme('system')
    return () => setTheme('system')
  },
  render: (args) => (
    <>
      <ThemeToggle {...args} />
      <Current />
    </>
  ),
} satisfies Meta<typeof ThemeToggle>
export default meta
type Story = StoryObj<typeof meta>

export const CyclesThroughThemes: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('button', { name: 'Theme: system' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByRole('button', { name: 'Theme: light' })).toBeVisible()
    await expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    await userEvent.click(canvas.getByRole('button'))
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByLabelText('Current theme')).toHaveTextContent('system')
  },
}

export const KeyboardOperation: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(canvas.getByRole('button')).toHaveFocus()
    // 이 버튼은 아직 자기 포커스 링이 없다 — 브라우저 기본 링(`auto`)이 보인다. 없어지면(`none`) 실패한다
    await expect(getComputedStyle(canvas.getByRole('button')).outlineStyle).not.toBe('none')
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByLabelText('Current theme')).toHaveTextContent('light')
  },
}

export const TranslatedLabels: Story = {
  args: {
    label: (theme) => `테마: ${theme}`,
    title: (theme) => `테마: ${theme} (눌러서 바꾸기)`,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '테마: system' })).toHaveAttribute(
      'title',
      '테마: system (눌러서 바꾸기)',
    )
  },
}
