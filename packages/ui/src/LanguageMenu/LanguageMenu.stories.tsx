import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
import { LanguageMenu } from './LanguageMenu'

/**
 * 헤더의 화면 언어 메뉴 — 날 `<select>` 에 지구본 아이콘. **글자는 prop 이고 i18n 라이브러리를 모른다**:
 * `label`(이름)은 앱이 번역해 넘기고, 선택지는 자기 말로 쓴 이름(`한국어` · `English` — 못 읽는 사람에게 못 읽는 글로 안내하지 않는다)이다.
 * `@skeleton/i18n` 의 `useT()` 가 `locale` · `localeOptions` · `setLocale` 을 주므로 그대로 이으면 된다(README 의 「번역된 라벨 먹이기」).
 */
const meta = {
  title: 'UI/LanguageMenu',
  component: LanguageMenu,
  args: {
    label: 'Language',
    value: 'en',
    options: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
      { value: 'ja', label: '日本語' },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof LanguageMenu>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const menu = canvas.getByRole('combobox', { name: 'Language' })
    await expect(menu).toHaveDisplayValue('English')
    await expect(canvas.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '한국어',
      'English',
      '日本語',
    ])
  },
}

export const PicksAnotherLanguage: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return (
      <LanguageMenu
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next)
          args.onChange(next)
        }}
      />
    )
  },
  play: async ({ canvas, args, userEvent }) => {
    const menu = canvas.getByRole('combobox', { name: 'Language' })
    await userEvent.selectOptions(menu, 'ja')
    await expect(args.onChange).toHaveBeenCalledWith('ja')
    await expect(menu).toHaveDisplayValue('日本語')
    await expect(menu).toHaveAttribute('lang', 'ja')
  },
}

export const KeyboardOperation: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const menu = canvas.getByRole('combobox', { name: 'Language' })
    await expect(menu).toHaveFocus()
    await expect(getComputedStyle(menu).outlineStyle).toBe('solid')
  },
}

export const TranslatedLabelTheOptionsStayInTheirOwnLanguage: Story = {
  args: { label: '언어', value: 'ko' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox', { name: '언어' })).toHaveDisplayValue('한국어')
    await expect(canvas.getByRole('option', { name: 'English' })).toHaveAttribute('lang', 'en')
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox', { name: 'Language' })).toBeVisible()
  },
}
