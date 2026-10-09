import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
import { ChoiceGroup, type ChoiceOption } from './ChoiceGroup'

/**
 * 하나만 고르는 선택지 묶음 — 금액 · 크기 · 주기처럼 몇 개 안 되는 선택지를 한눈에 펼쳐 놓고 고를 때(WAI-ARIA radio group).
 * 칸마다 테두리 있는 단추라 눌리는 것으로 보이고, 고른 칸은 색만이 아니라 체크(✓) · 굵은 글씨 · 안쪽 선으로도 말한다.
 * Tab 은 묶음에 한 번만 멈추고 화살표 · Home · End 가 고른 칸을 옮긴다. 이름은 `aria-label`, 화면에 보이는 제목이 있으면 `aria-labelledby` 로 이어 같은 글이 두 번 읽히지 않게 한다.
 */
const options: ChoiceOption[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

const meta = {
  title: 'UI/ChoiceGroup',
  component: ChoiceGroup,
  args: { options, value: 'medium', onChange: fn(), 'aria-label': 'Size' },
} satisfies Meta<typeof ChoiceGroup>
export default meta
type Story = StoryObj<typeof meta>

/** 눌러서 고르면 고른 칸이 바뀐다 — 부모가 `value` 를 들고 있는 정본 쓰임 */
function Controlled({ start, ...rest }: { start: string | null } & Partial<Story['args']>) {
  const [value, setValue] = useState<string | null>(start)
  return (
    <ChoiceGroup options={options} aria-label="Size" {...rest} value={value} onChange={setValue} />
  )
}

export const Default: Story = {
  render: () => <Controlled start="medium" />,
  play: async ({ canvas, userEvent }) => {
    const radios = canvas.getAllByRole('radio')
    await expect(radios).toHaveLength(3)
    await expect(canvas.getByRole('radio', { name: /Medium/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await userEvent.click(canvas.getByRole('radio', { name: 'Large' }))
    await expect(canvas.getByRole('radio', { name: /Large/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(canvas.getByRole('radio', { name: 'Medium' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  },
}

/** 고른 칸은 색만이 아니라 체크 표시로도 — 고른 칸에만 ✓ 가 있다 */
export const ChosenIsMarkedBeyondColour: Story = {
  play: async ({ canvas }) => {
    const chosen = canvas.getByRole('radio', { name: /Medium/ })
    await expect(chosen).toHaveTextContent('✓')
    await expect(canvas.getByRole('radio', { name: 'Small' })).not.toHaveTextContent('✓')
    await expect(canvas.getByRole('radio', { name: 'Large' })).not.toHaveTextContent('✓')
  },
}

/** Tab 은 묶음에 한 번만 멈추고(고른 칸), 곧바로 묶음 밖으로 나간다 */
export const OneStopInTheTabOrder: Story = {
  render: (args) => (
    <>
      <ChoiceGroup {...args} />
      <a href="#after">After the group</a>
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(canvas.getByRole('radio', { name: /Medium/ })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'After the group' })).toHaveFocus()
    await expect(canvas.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toHaveLength(
      1,
    )
  },
}

/** 화살표 키가 고른 칸을 옮기고 포커스가 따라간다 — 끝에서 처음으로 돌아간다 */
export const ArrowKeysMoveTheChoiceAndFocus: Story = {
  render: () => <Controlled start="medium" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    const large = canvas.getByRole('radio', { name: /Large/ })
    await expect(large).toHaveFocus()
    await expect(large).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('{ArrowRight}') // 끝 → 처음
    await expect(canvas.getByRole('radio', { name: /Small/ })).toHaveFocus()
    await expect(canvas.getByRole('radio', { name: /Small/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await userEvent.keyboard('{ArrowLeft}') // 처음 → 끝
    await expect(canvas.getByRole('radio', { name: /Large/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect(canvas.getByRole('radio', { name: /Medium/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('radio', { name: /Large/ })).toHaveFocus()
  },
}

export const HomeAndEnd: Story = {
  render: () => <Controlled start="medium" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await userEvent.keyboard('{End}')
    await expect(canvas.getByRole('radio', { name: /Large/ })).toHaveFocus()
    await expect(canvas.getByRole('radio', { name: /Large/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await userEvent.keyboard('{Home}')
    await expect(canvas.getByRole('radio', { name: /Small/ })).toHaveFocus()
    await expect(canvas.getByRole('radio', { name: /Small/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  },
}

/** 아무것도 안 골랐으면 첫 칸이 Tab 이 닿는 자리다 — 화살표 키가 첫 선택을 한다 */
export const NothingChosenYet: Story = {
  render: () => <Controlled start={null} />,
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getAllByRole('radio').filter((radio) => radio.getAttribute('aria-checked') === 'true'),
    ).toHaveLength(0)
    await userEvent.tab()
    await expect(canvas.getByRole('radio', { name: 'Small' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('radio', { name: /Medium/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  },
}

/** 잠그면(예: 결제창을 여는 중) 누르거나 화살표를 눌러도 바뀌지 않는다 — 단추는 읽기 프로그램에 그대로 남는다 */
export const Locked: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    const radios = canvas.getAllByRole('radio')
    for (const radio of radios) await expect(radio).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(canvas.getByRole('radio', { name: 'Large' }))
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

/** 화면에 보이는 제목이 있으면 `aria-labelledby` 로 — 같은 글이 `aria-label` 로 한 번 더 읽히지 않는다 */
export const NamedByAVisibleHeading: Story = {
  render: () => (
    <div>
      <span id="size-legend">Pick a size</span>
      <ChoiceGroup
        options={options}
        value="small"
        onChange={() => undefined}
        aria-labelledby="size-legend"
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const group = canvas.getByRole('radiogroup', { name: 'Pick a size' })
    await expect(group).toHaveAttribute('aria-labelledby', 'size-legend')
    await expect(group).not.toHaveAttribute('aria-label')
  },
}

/** 쉬는 상태에서도 눌리는 것으로 보인다 — 테두리가 있고 44px 이상이다(글자만 있는 단추가 아니다). 고른 칸의 안쪽 선은 고르지 않은 칸에 없다 */
export const LooksPressableAtRest: Story = {
  play: async ({ canvas }) => {
    const small = canvas.getByRole('radio', { name: 'Small' })
    const chosen = canvas.getByRole('radio', { name: /Medium/ })
    await expect(parseFloat(getComputedStyle(small).borderTopWidth)).toBeGreaterThan(0)
    await expect(small.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    await expect(getComputedStyle(small).boxShadow).toBe('none')
    await expect(getComputedStyle(chosen).boxShadow).not.toBe('none')
    await expect(getComputedStyle(chosen).borderTopColor).not.toBe(
      getComputedStyle(small).borderTopColor,
    )
  },
}

export const FocusRing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(getComputedStyle(canvas.getByRole('radio', { name: /Medium/ })).outlineStyle).toBe(
      'solid',
    )
  },
}
