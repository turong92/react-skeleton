import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
import { SwitchRow } from './SwitchRow'

/**
 * 「제목 · 설명 … 스위치」 한 줄 — 설정 화면의 즉시 적용 옵션. 줄 전체가 라벨이라 어디를 눌러도 바뀐다.
 * 이름은 제목만, 설명은 `aria-describedby` 로 읽힌다. 저장 중이면 `busy`(잠그지 않아 포커스가 남는다), 못 바꾸는 이유는 `describedBy` 로 잇는다.
 * 제어 컴포넌트다 — `checked` 와 `onChange(next)` 를 앱이 쥔다(보통 `useMutation` + 낙관적 갱신).
 */
type Props = Parameters<typeof SwitchRow>[0]

function Controlled({ checked: initial, onChange, ...rest }: Props) {
  const [checked, setChecked] = useState(initial)
  return (
    <SwitchRow
      {...rest}
      checked={checked}
      onChange={(next) => {
        setChecked(next)
        onChange(next)
      }}
    />
  )
}

const meta = {
  title: 'UI/SwitchRow',
  component: SwitchRow,
  args: {
    title: 'Email notifications',
    description: 'A weekly summary, never more',
    checked: false,
    onChange: fn(),
  },
  render: (args) => (
    <div style={{ maxWidth: '32rem' }}>
      <Controlled {...args} />
    </div>
  ),
} satisfies Meta<typeof SwitchRow>
export default meta
type Story = StoryObj<typeof meta>

export const ClickAnywhereOnTheRow: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const toggle = canvas.getByRole('switch', { name: 'Email notifications' })
    await expect(toggle).not.toBeChecked()
    await userEvent.click(canvas.getByText('A weekly summary, never more'))
    await expect(toggle).toBeChecked()
    await expect(args.onChange).toHaveBeenLastCalledWith(true)
    await userEvent.click(canvas.getByText('Email notifications'))
    await expect(args.onChange).toHaveBeenLastCalledWith(false)
  },
}

export const NamedByTitleDescribedByDescription: Story = {
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole('switch')
    await expect(toggle).toHaveAccessibleName('Email notifications')
    await expect(toggle).toHaveAccessibleDescription('A weekly summary, never more')
  },
}

export const KeyboardOperation: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab()
    const toggle = canvas.getByRole('switch')
    await expect(toggle).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect(toggle).toBeChecked()
    await expect(args.onChange).toHaveBeenCalledWith(true)
  },
}

export const On: Story = {
  args: { checked: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toBeChecked()
  },
}

export const Disabled: Story = {
  args: { disabled: true, describedBy: 'locked-reason' },
  render: (args) => (
    <div style={{ maxWidth: '32rem' }}>
      <Controlled {...args} />
      <p id="locked-reason">Managed by your organisation</p>
    </div>
  ),
  play: async ({ canvas, args, userEvent }) => {
    const toggle = canvas.getByRole('switch')
    await userEvent.click(toggle)
    await expect(args.onChange).not.toHaveBeenCalled()
    await expect(toggle).toHaveAccessibleDescription(
      'A weekly summary, never more Managed by your organisation',
    )
  },
}

export const BusyKeepsFocus: Story = {
  args: { busy: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const toggle = canvas.getByRole('switch')
    await expect(toggle).toHaveFocus()
    await expect(toggle).toHaveAttribute('aria-busy', 'true')
    await expect(toggle).toBeEnabled()
  },
}

export const Invalid: Story = {
  args: { invalid: true, describedBy: 'switch-error' },
  render: (args) => (
    <div style={{ maxWidth: '32rem' }}>
      <Controlled {...args} />
      <p id="switch-error" role="alert">
        Could not save, try again
      </p>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toBeInvalid()
  },
}

export const NoDescription: Story = {
  args: { description: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toHaveAccessibleDescription('')
  },
}

export const NarrowColumnWraps: Story = {
  args: {
    title: 'Send me an email whenever anything at all happens in any of my projects, day or night',
  },
  render: (args) => (
    <div style={{ maxWidth: '16rem' }}>
      <Controlled {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getByRole('switch')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { checked: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toBeChecked()
  },
}
