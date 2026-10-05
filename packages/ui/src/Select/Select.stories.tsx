import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { Select } from './Select'

/** 네이티브 `<select>` — 옵션은 `<option>` 자식으로. 라벨은 `<Field>` 가 이어 준다. */
const meta = {
  title: 'UI/Select',
  component: Select,
  args: {
    'aria-label': 'Country',
    onChange: fn(),
    children: [
      <option key="kr" value="kr">
        Korea
      </option>,
      <option key="us" value="us">
        United States
      </option>,
      <option key="jp" value="jp">
        Japan
      </option>,
    ],
  },
} satisfies Meta<typeof Select>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const select = canvas.getByRole('combobox', { name: 'Country' })
    await userEvent.selectOptions(select, 'us')
    await expect(select).toHaveValue('us')
    await expect(args.onChange).toHaveBeenCalledTimes(1)
  },
}

/** Tab 으로 들어오고 포커스 링이 보인다(옵션 고르기 자체는 브라우저 몫이라 `selectOptions` 로 검증한다) */
export const FocusRing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const select = canvas.getByRole('combobox')
    await expect(select).toHaveFocus()
    await expect(getComputedStyle(select).outlineStyle).toBe('solid')
  },
}

export const Invalid: Story = {
  args: { invalid: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true')
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox')).toBeDisabled()
  },
}
