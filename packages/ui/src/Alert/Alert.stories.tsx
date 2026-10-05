import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn } from 'storybook/test'
import { Alert } from './Alert'

/**
 * 문서 안에 박히는 안내 · 경고 띠 — 토스트와 달리 사라지지 않고 다음 할 일(`action`)을 곁에 둔다.
 * 위험 · 경고는 `role="alert"`(즉시 낭독), 안내 · 성공은 `role="status"`(차분히). 종류는 색뿐 아니라 보이지 않는 말머리로도 낭독된다.
 */
const meta = {
  title: 'UI/Alert',
  component: Alert,
  args: {
    title: 'Payment method expires soon',
    children: 'Update it before 31 October to keep your plan.',
  },
} satisfies Meta<typeof Alert>
export default meta
type Story = StoryObj<typeof meta>

export const Tones: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <Alert {...args} tone="info" title="Info" />
      <Alert {...args} tone="success" title="Success" />
      <Alert {...args} tone="warning" title="Warning" />
      <Alert {...args} tone="danger" title="Error" />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('alert')).toHaveLength(2)
    await expect(canvas.getAllByRole('status')).toHaveLength(2)
  },
}

const onDismiss = fn()
function DismissibleDemo(props: ComponentProps<typeof Alert>) {
  const [visible, setVisible] = useState(true)
  return visible ? (
    <Alert
      {...props}
      tone="warning"
      action={<a href="#billing">Update card</a>}
      dismissLabel="Dismiss notice"
      onDismiss={() => {
        onDismiss()
        setVisible(false)
      }}
    />
  ) : (
    <p>Dismissed</p>
  )
}

export const DismissibleWithAction: Story = {
  beforeEach: () => onDismiss.mockClear(),
  render: (args) => <DismissibleDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('link', { name: 'Update card' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss notice' }))
    await expect(onDismiss).toHaveBeenCalledTimes(1)
    await expect(canvas.getByText('Dismissed')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: Tones.render,
  play: Tones.play,
}
