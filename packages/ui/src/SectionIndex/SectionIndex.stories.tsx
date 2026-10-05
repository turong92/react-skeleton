import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { SectionCard } from '../SectionCard/SectionCard'
import { SectionIndex } from './SectionIndex'

/**
 * 긴 설정 · 폼 화면의 「이 페이지」 목차 — 절로 건너뛰는 앵커 칩. 누르면 그 절로 스크롤하고 절 제목으로 포커스를 옮기며(키보드 · 낭독 사용자가 도착을 안다),
 * 화면 위쪽에 걸린 절을 `aria-current="location"` 으로 표시한다. 접힌 절은 `onJump(id)` 에서 펼치면 도착한 절이 열려 있다.
 * `SectionCard` 의 `id` 가 앵커다. JavaScript 없이도 `href="#id"` 로 동작한다.
 */
const meta = {
  title: 'UI/SectionIndex',
  component: SectionIndex,
  args: {
    label: 'On this page',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'notifications', label: 'Notifications', count: 3 },
      { id: 'security', label: 'Security' },
    ],
  },
} satisfies Meta<typeof SectionIndex>
export default meta
type Story = StoryObj<typeof meta>

const filler = { minHeight: '60vh' } as const

function Page({ onJump }: { onJump: (id: string) => void }) {
  const [securityOpen, setSecurityOpen] = useState(false)
  return (
    <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <SectionIndex
        label="On this page"
        items={[
          { id: 'profile', label: 'Profile' },
          { id: 'notifications', label: 'Notifications', count: 3 },
          { id: 'security', label: 'Security' },
        ]}
        onJump={(id) => {
          onJump(id)
          if (id === 'security') setSecurityOpen(true)
        }}
      />
      <SectionCard id="profile" title="Profile">
        <div style={filler}>Profile body</div>
      </SectionCard>
      <SectionCard id="notifications" title="Notifications">
        <div style={filler}>Notifications body</div>
      </SectionCard>
      <SectionCard
        id="security"
        title="Security"
        collapsible
        expanded={securityOpen}
        onToggle={setSecurityOpen}
      >
        <div style={filler}>Security body</div>
      </SectionCard>
    </div>
  )
}

export const Default: Story = {
  play: async ({ canvas }) => {
    const nav = canvas.getByRole('navigation', { name: 'On this page' })
    await expect(nav).toBeVisible()
    await expect(canvas.getByRole('link', { name: /Profile/ })).toHaveAttribute('href', '#profile')
    await expect(canvas.getByRole('link', { name: /Notifications/ })).toHaveAccessibleName(
      'Notifications 3',
    )
  },
}

export const JumpScrollsAndMovesFocusToTheHeading: Story = {
  args: { onJump: fn() },
  render: (args) => <Page onJump={args.onJump ?? (() => undefined)} />,
  play: async ({ canvas, userEvent }) => {
    const link = canvas.getByRole('link', { name: /Notifications/ })
    await userEvent.click(link)
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'Notifications' })).toHaveFocus(),
    )
    await expect(link).toHaveAttribute('aria-current', 'location')
    await expect(canvas.getByRole('link', { name: /Profile/ })).not.toHaveAttribute('aria-current')
  },
}

export const KeyboardJump: Story = {
  args: { onJump: fn() },
  render: (args) => <Page onJump={args.onJump ?? (() => undefined)} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: /Notifications/ })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'Notifications' })).toHaveFocus(),
    )
  },
}

export const JumpOpensACollapsedSection: Story = {
  args: { onJump: fn() },
  render: (args) => <Page onJump={args.onJump ?? (() => undefined)} />,
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByText('Security body')).not.toBeVisible()
    await userEvent.click(canvas.getByRole('link', { name: 'Security' }))
    await expect(args.onJump).toHaveBeenCalledWith('security')
    await waitFor(() => expect(canvas.getByText('Security body')).toBeVisible())
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Security' })).toHaveFocus())
  },
}

export const NarrowScreenScrollsInsteadOfOverflowingThePage: Story = {
  args: {
    items: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, label: `Section number ${i}` })),
  },
  play: async () => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('navigation', { name: 'On this page' })).toBeVisible()
  },
}
