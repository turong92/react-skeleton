import type { Meta, StoryObj } from '@storybook/react-vite'
import { useId, useState, type FormEvent } from 'react'
import { expect, waitFor } from 'storybook/test'
import { Button } from '../Button/Button'
import { Checkbox } from '../Checkbox/Checkbox'
import { Field } from '../Field/Field'
import { Input } from '../Input/Input'
import { FormProblems, type FormProblem } from './FormProblems'
import { useSubmitAttempt } from './useSubmitAttempt'

/**
 * 제출했는데 아무 일도 없어 보이는 폼을 없애는 틀 — 제출 버튼은 **늘 눌린다**(꺼진 버튼은 이유를 말하지 못한다).
 * 비었거나 틀리면: ① 제출 버튼 바로 위에 `role="alert"` 요약(줄마다 그 칸으로 데려가는 버튼) ② 첫 틀린 칸으로 포커스 + 화면 안으로 스크롤
 * ③ 틀린 칸에 오류 테두리 + `aria-invalid` ④ 고치면 곧바로 사라진다. `useSubmitAttempt` 가 「시도했다」를 기억하고 포커스를 옮긴다.
 */
function Demo({ tall = false }: { tall?: boolean }) {
  const uid = useId()
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [sent, setSent] = useState(false)
  const attempt = useSubmitAttempt()
  const ids = { email: `${uid}-email`, consent: `${uid}-consent` }
  const problems: FormProblem[] = [
    ...(email.trim() ? [] : [{ key: 'email', message: 'Enter your email', target: ids.email }]),
    ...(agreed
      ? []
      : [{ key: 'consent', message: 'Agree to the required terms', target: ids.consent }]),
  ]
  const shown = attempt.attempted ? problems : []

  function submit(event: FormEvent) {
    event.preventDefault()
    if (problems.length > 0) return attempt.fail(problems[0].target)
    setSent(true)
  }

  return (
    <form noValidate onSubmit={submit} aria-label="Demo" style={{ display: 'grid', gap: 16 }}>
      {tall && <div style={{ height: '120vh' }} aria-hidden="true" />}
      <Field
        label="Email"
        id={ids.email}
        required
        error={shown.some((p) => p.key === 'email') ? 'Enter your email' : undefined}
      >
        {(control) => (
          <Input {...control} value={email} onChange={(event) => setEmail(event.target.value)} />
        )}
      </Field>
      {tall && <div style={{ height: '120vh' }} aria-hidden="true" />}
      <Checkbox
        id={ids.consent}
        label="I agree to the terms (required)"
        checked={agreed}
        onChange={(event) => setAgreed(event.target.checked)}
        error={shown.some((p) => p.key === 'consent') ? 'Required' : undefined}
      />
      <FormProblems title="Check these before continuing" problems={shown} />
      <Button type="submit">Create account</Button>
      {sent && <p role="status">Sent</p>}
    </form>
  )
}

const meta = {
  title: 'UI/FormProblems',
  component: Demo,
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const SummaryAndFocusOnEmptySubmit: Story = {
  play: async ({ canvas, userEvent }) => {
    // 제출 버튼은 꺼져 있지 않다
    const submit = canvas.getByRole('button', { name: 'Create account' })
    await expect(submit).toBeEnabled()
    await userEvent.click(submit)
    const alert = await canvas.findByText('Check these before continuing')
    await expect(alert.closest('[role="alert"]')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Enter your email' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Agree to the required terms' })).toBeVisible()
    // 첫 틀린 칸으로 포커스
    await waitFor(() => expect(canvas.getByLabelText(/^Email/)).toHaveFocus())
    // 틀린 칸이 표시된다
    await expect(canvas.getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
  },
}

export const InvalidCheckboxHasAnOutline: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    const box = canvas.getByRole('checkbox')
    await waitFor(() => expect(getComputedStyle(box).outlineStyle).toBe('solid'))
    await expect(getComputedStyle(box).outlineWidth).toBe('2px')
  },
}

export const SummaryItemsFocusTheControl: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Agree to the required terms' }),
    )
    await waitFor(() => expect(canvas.getByRole('checkbox')).toHaveFocus())
  },
}

export const FixingClearsTheProblemAtOnce: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await userEvent.click(await canvas.findByRole('checkbox'))
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: 'Agree to the required terms' })).toBeNull(),
    )
    await expect(canvas.getByRole('checkbox')).not.toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(canvas.getByLabelText(/^Email/), 'a@b.co')
    await waitFor(() => expect(canvas.queryByText('Check these before continuing')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(await canvas.findByRole('status')).toHaveTextContent('Sent')
  },
}

export const ScrollsTheFirstProblemIntoView: Story = {
  args: { tall: true },
  play: async ({ canvas, userEvent }) => {
    const submit = canvas.getByRole('button', { name: 'Create account' })
    submit.scrollIntoView({ block: 'end' })
    await userEvent.click(submit)
    const email = canvas.getByLabelText(/^Email/)
    await waitFor(() => {
      const box = email.getBoundingClientRect()
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    })
    await expect(email).toHaveFocus()
  },
}
