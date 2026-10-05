import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { Field } from '../Field/Field'
import { Combobox, type ComboboxOption, type ComboboxProps } from './Combobox'

/**
 * 자동완성 입력 — WAI-ARIA combobox(편집 가능 · 목록 팝업). 정해진 목록(`options`)은 입력한 글로 안에서 거르고,
 * 서버에서 찾는 목록(`loadOptions(query, signal)`)은 입력을 멈춘 뒤 부르며 먼저 보낸 느린 응답이 나중에 와도 버린다.
 * ↓↑ 후보 이동 · Enter 선택 · Esc 닫기(한 번 더 누르면 비움) · 포커스가 나가면 후보에 없는 글은 고른 라벨로 되돌아간다. `Field` 안에서 `Input` 처럼.
 */
const cities: ComboboxOption[] = [
  { value: 'seoul', label: 'Seoul', description: 'South Korea' },
  { value: 'busan', label: 'Busan', description: 'South Korea' },
  { value: 'sao', label: 'São Paulo', description: 'Brazil' },
  { value: 'sendai', label: 'Sendai', description: 'Japan', disabled: true },
]

const onSelect = fn()
const meta = {
  title: 'UI/Combobox',
  component: Combobox,
  args: { selected: null, onSelect, options: cities, placeholder: 'Pick a city' },
  beforeEach: () => onSelect.mockClear(),
} satisfies Meta<typeof Combobox>
export default meta
type Story = StoryObj<typeof meta>

function Demo(props: Partial<ComboboxProps>) {
  const [selected, setSelected] = useState<ComboboxOption | null>(null)
  return (
    <Field label="City" hint="Start typing a name">
      {(control) => (
        <Combobox
          {...control}
          options={cities}
          placeholder="Pick a city"
          {...props}
          selected={selected}
          onSelect={(option) => {
            onSelect(option)
            setSelected(option)
          }}
        />
      )}
    </Field>
  )
}

export const FilterAndPickWithTheKeyboard: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('combobox', { name: 'City' })
    await expect(input).toHaveAttribute('aria-expanded', 'false')
    await userEvent.type(input, 'se')
    await expect(input).toHaveAttribute('aria-expanded', 'true')
    // Seoul · (Sendai 는 잠김) — 둘 다 보이되 잠긴 것은 건너뛴다
    await expect(canvas.getAllByRole('option')).toHaveLength(2)
    await userEvent.keyboard('{ArrowDown}')
    await expect(input).toHaveAttribute(
      'aria-activedescendant',
      canvas.getByRole('option', { name: /Seoul/ }).id,
    )
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('option', { name: /Seoul/ })).toHaveAttribute(
      'data-active',
      'true',
    ) // 잠긴 Sendai 는 건너뛰고 돈다
    await userEvent.keyboard('{Enter}')
    await expect(input).toHaveValue('Seoul')
    await expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 'seoul' }))
    await expect(canvas.queryByRole('listbox')).toBeNull()
    await expect(input).toHaveFocus()
  },
}

export const ClickingAnOptionPicks: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('combobox', { name: 'City' })
    await userEvent.click(input)
    await userEvent.click(await canvas.findByRole('option', { name: /Busan/ }))
    await expect(input).toHaveValue('Busan')
    await expect(input).toHaveFocus()
  },
}

export const AccentsAreIgnored: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('combobox', { name: 'City' }), 'sao')
    await expect(canvas.getByRole('option', { name: /São Paulo/ })).toBeVisible()
  },
}

export const EscapeClosesThenClears: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('combobox', { name: 'City' })
    await userEvent.type(input, 'bus{ArrowDown}{Enter}')
    await expect(input).toHaveValue('Busan')
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('listbox')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(canvas.queryByRole('listbox')).toBeNull()
    await expect(input).toHaveValue('Busan')
    await userEvent.keyboard('{Escape}')
    await expect(input).toHaveValue('')
    await expect(onSelect).toHaveBeenLastCalledWith(null)
  },
}

export const TextThatIsNotAnOptionRevertsOnBlur: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('combobox', { name: 'City' })
    await userEvent.type(input, 'sul{ArrowDown}{Enter}') // 후보 없음 → 선택 없음
    await userEvent.clear(input)
    await userEvent.type(input, 'zzz')
    await expect(canvas.getByRole('status')).toHaveTextContent('No results')
    await userEvent.tab()
    await expect(input).toHaveValue('')
    await expect(onSelect).not.toHaveBeenCalled()
  },
}

/** 느린 첫 질의(`a`)가 빠른 둘째 질의(`ab`)보다 늦게 도착한다 — 옛 응답이 화면을 덮어쓰면 안 된다 */
const racing = async (query: string, signal: AbortSignal) => {
  await new Promise((resolve) => setTimeout(resolve, query.length === 1 ? 400 : 30))
  if (signal.aborted) throw new DOMException('aborted', 'AbortError')
  return [{ value: `r-${query}`, label: `Result for ${query}` }]
}

export const AsyncLatestAnswerWins: Story = {
  render: () => <Demo options={undefined} loadOptions={racing} debounceMs={10} />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('combobox', { name: 'City' })
    await userEvent.type(input, 'a')
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading')
    await new Promise((resolve) => setTimeout(resolve, 40))
    await userEvent.type(input, 'b')
    await expect(await canvas.findByRole('option', { name: 'Result for ab' })).toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, 500))
    await expect(canvas.queryByRole('option', { name: 'Result for a' })).toBeNull()
    await expect(canvas.getByRole('status')).toHaveTextContent('1 results')
  },
}

export const AsyncFailureIsAnnounced: Story = {
  render: () => (
    <Demo
      options={undefined}
      loadOptions={async () => {
        throw new Error('boom')
      }}
      debounceMs={0}
      errorLabel="Could not load cities"
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('combobox', { name: 'City' }), 'x')
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent('Could not load cities'),
    )
  },
}

export const MinCharsHoldsBackTheSearch: Story = {
  render: () => {
    const loadOptions = fn(async () => cities)
    return <Demo options={undefined} loadOptions={loadOptions} minChars={2} debounceMs={0} />
  },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('combobox', { name: 'City' })
    await userEvent.type(input, 's')
    await expect(canvas.queryByRole('listbox')).toBeNull()
    await userEvent.type(input, 'e')
    await expect(await canvas.findByRole('listbox')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'City' }))
    await expect(await canvas.findByRole('listbox')).toBeVisible()
  },
}
