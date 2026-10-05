import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Input } from '../Input/Input'
import { Select } from '../Select/Select'
import { Textarea } from '../Textarea/Textarea'
import { Field } from './Field'

/**
 * 입력칸은 항상 `<Field>` 안에 둔다 — 라벨 · 도움말 · 오류가 `id` / `aria-describedby` / `aria-invalid` 로 입력칸에 이어진다.
 * 입력 부품에는 render prop 의 `control` 을 그대로 펼친다: `{(control) => <Input {...control} />}`.
 */
const meta = {
  title: 'UI/Field',
  component: Field,
  args: {
    label: 'Email',
    children: (control) => <Input {...control} type="email" />,
  },
} satisfies Meta<typeof Field>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Email')
    await expect(input).not.toHaveAttribute('aria-invalid')
    await expect(input).not.toHaveAttribute('aria-describedby')
    await userEvent.click(canvas.getByText('Email'))
    await expect(input).toHaveFocus()
  },
}

export const WithHint: Story = {
  args: { hint: 'We only use it to send the receipt' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Email')).toHaveAccessibleDescription(
      'We only use it to send the receipt',
    )
  },
}

export const Required: Story = {
  args: { required: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('*')).toBeVisible()
  },
}

export const WithError: Story = {
  args: { error: 'Enter a valid email address', hint: 'name@example.com' },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Email')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    // 오류가 먼저, 도움말이 그 뒤로 이어진다
    await expect(input).toHaveAccessibleDescription('Enter a valid email address name@example.com')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a valid email address')
  },
}

export const LongText: Story = {
  args: {
    label: 'A very long label that explains in detail what the person is expected to type here',
    hint: 'A very long hint that goes on and on so that we can see how it wraps inside a narrow column of the page',
  },
  render: (args) => (
    <div style={{ maxWidth: '18rem' }}>
      <Field {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText(/A very long label/)
    await expect(input.getBoundingClientRect().width).toBeLessThanOrEqual(288)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

export const WithSelectAndTextarea: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--space-md)', maxWidth: '24rem' }}>
      <Field label="Country">
        {(control) => (
          <Select {...control}>
            <option value="kr">Korea</option>
            <option value="us">United States</option>
          </Select>
        )}
      </Field>
      <Field label="Message" hint="Up to 200 characters">
        {(control) => <Textarea {...control} />}
      </Field>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox', { name: 'Country' })).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: 'Message' })).toHaveAccessibleDescription(
      'Up to 200 characters',
    )
  },
}
