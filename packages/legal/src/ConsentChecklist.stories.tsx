import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
import { ConsentChecklist } from './ConsentChecklist'
import type { ConsentRow } from './consentLogic'
import { koLegalLabels } from './labels'

/**
 * 가입 · 재동의가 같이 쓰는 동의 체크리스트 — 필수 · 선택 줄, 「전체 동의」(일부만이면 mixed), 줄마다 「보기」.
 * 체크 상태는 부모가 쥐고, 서버로 보낼 값은 `consentRequestsOf(rows, checked)`.
 */
const rows: ConsentRow[] = [
  {
    type: 'terms',
    version: '2026-10-01',
    locale: 'ko',
    title: '이용약관',
    kind: 'required',
    template: false,
  },
  {
    type: 'privacy',
    version: '2026-10-01',
    locale: 'ko',
    title: '개인정보 처리방침',
    kind: 'required',
    template: false,
  },
  {
    type: 'marketing',
    version: 'v3',
    locale: 'ko',
    title: '마케팅 정보 수신 동의',
    kind: 'optional',
    template: false,
  },
]

function Demo(props: Partial<React.ComponentProps<typeof ConsentChecklist>>) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  return (
    <ConsentChecklist
      rows={rows}
      checked={checked}
      onChange={setChecked}
      labels={koLegalLabels}
      {...props}
    />
  )
}

const meta = {
  title: 'Packages/Legal/Consent checklist',
  component: Demo,
  args: { onOpen: fn() },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const AgreeAllThenUncheckOne: Story = {
  play: async ({ canvas, userEvent }) => {
    const all = canvas.getByRole('checkbox', { name: '전체 동의' })
    await userEvent.click(all)
    for (const box of canvas.getAllByRole('checkbox')) await expect(box).toBeChecked()
    // 하나를 끄면 전체 동의는 mixed(전부도 아니고 없음도 아니다)
    await userEvent.click(canvas.getByRole('checkbox', { name: /마케팅/ }))
    await expect(all).toHaveAttribute('aria-checked', 'mixed')
    await expect(all).not.toBeChecked()
    await userEvent.click(all)
    await expect(canvas.getByRole('checkbox', { name: /마케팅/ })).toBeChecked()
  },
}

export const RequiredAndOptionalAreLabelled: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox', { name: /\[필수\] 이용약관/ })).not.toBeChecked()
    await expect(canvas.getByRole('checkbox', { name: /\[선택\] 마케팅/ })).not.toBeChecked() // 선택은 꺼진 채 시작
  },
}

export const ViewOpensTheDocumentOfThatRow: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '개인정보 처리방침 보기' }))
    await expect(args.onOpen).toHaveBeenCalledWith(expect.objectContaining({ type: 'privacy' }))
  },
}

export const ErrorOnRequiredRowsOnly: Story = {
  args: { showError: true },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('필수 항목에 동의해 주세요.')).toHaveLength(2) // 선택 줄에는 오류가 없다
  },
}

export const AgreeAllIsExplained: Story = {
  play: async ({ canvas }) => {
    // 「전체 동의」 가 무엇을 하는지 — 선택 항목까지 켠다는 것을 줄 아래 설명이 말한다
    await expect(canvas.getByRole('checkbox', { name: '전체 동의' })).toHaveAccessibleDescription(
      koLegalLabels.agreeAllHint,
    )
  },
}

export const MissingRequiredRowsAreMarkedAndTheOptionalOneIsNot: Story = {
  args: { showError: true },
  play: async ({ canvas, userEvent }) => {
    const terms = canvas.getByRole('checkbox', { name: /\[필수\] 이용약관/ })
    await expect(terms).toHaveAttribute('aria-invalid', 'true')
    await expect(terms.closest('li')).toHaveAttribute('data-invalid', 'true') // 줄 테두리
    await expect(getComputedStyle(terms).outlineStyle).toBe('solid') // 체크 상자 윤곽
    await expect(canvas.getByRole('checkbox', { name: /\[선택\]/ })).not.toHaveAttribute(
      'aria-invalid',
    )
    // 모자란 것을 체크하면 그 줄의 표시가 바로 사라진다(다른 필수 줄은 그대로)
    await userEvent.click(terms)
    await expect(terms).not.toHaveAttribute('aria-invalid')
    await expect(terms.closest('li')).not.toHaveAttribute('data-invalid')
    await expect(canvas.getByRole('checkbox', { name: /\[필수\] 개인정보/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  },
}

export const EnglishLabels: Story = {
  args: { labels: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox', { name: 'Agree to all' })).toBeVisible()
    await expect(canvas.getAllByRole('checkbox', { name: /\[Required\]/ })).toHaveLength(2)
  },
}
