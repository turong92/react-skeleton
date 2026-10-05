import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect } from 'storybook/test'
import { Button } from '../Button/Button'
import { Stepper } from './Stepper'

/**
 * 여러 단계 폼의 머리 — 순서 목록, 지금 단계는 `aria-current="step"`, 상태(끝남 · 지금 · 아직)는 글자로도 낭독된다.
 * `onStepSelect` 를 주면 끝낸 단계가 버튼이 되어 돌아갈 수 있다(앞으로는 못 간다 — 검증은 폼이 한다).
 */
const meta = {
  title: 'UI/Stepper',
  component: Stepper,
  args: {
    label: 'Sign-up progress',
    current: 1,
    steps: [
      { id: 'account', label: 'Account' },
      { id: 'profile', label: 'Profile', description: 'Tell us about you' },
      { id: 'plan', label: 'Plan' },
    ],
  },
} satisfies Meta<typeof Stepper>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const list = canvas.getByRole('list', { name: 'Sign-up progress' })
    await expect(list.querySelector('[aria-current="step"]')).toHaveTextContent('Profile')
    await expect(canvas.getByText('Completed')).toBeInTheDocument()
    await expect(canvas.getByText('Not started')).toBeInTheDocument()
  },
}

function FormDemo(props: ComponentProps<typeof Stepper>) {
  const [current, setCurrent] = useState(0)
  return (
    <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <Stepper {...props} current={current} onStepSelect={(index) => setCurrent(index)} />
      <div>
        <Button onClick={() => setCurrent((value) => Math.min(value + 1, props.steps.length - 1))}>
          Next
        </Button>
      </div>
    </div>
  )
}

export const InteractiveForm: Story = {
  render: (args) => <FormDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    // 끝낸 두 단계만 버튼
    const back = canvas.getByRole('button', { name: /Account/ })
    await userEvent.click(back)
    const list = canvas.getByRole('list', { name: 'Sign-up progress' })
    await expect(list.querySelector('[aria-current="step"]')).toHaveTextContent('Account')
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list', { name: 'Sign-up progress' })).toBeVisible()
  },
}
