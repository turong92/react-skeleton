import { Button, Card, Checkbox, Field, Input, PageHeader, Select, Textarea } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type FormEvent } from 'react'
import { expect, fn, waitFor } from 'storybook/test'

/*
 * 폼 화면 틀 — 입력칸(Field + Input/Select/Textarea/Checkbox) · 제출 때 검증 오류(첫 오류 칸으로 포커스) · 제출 중 · 성공 · 실패.
 * 복사해서 쓸 때: `onSubmit` 은 `useMutation` 의 `mutateAsync` 를 넘긴다. 입력칸마다 `name` 이 있어야 첫 오류로 포커스를 옮길 수 있다.
 * 서버의 필드 오류(`ApiRequestError.apiError.errors`)는 `errors` 상태에 같은 모양으로 넣으면 된다.
 */
type Values = { name: string; email: string; plan: string; notes: string; terms: boolean }
type Errors = Partial<Record<keyof Values, string>>
type Status = 'idle' | 'pending' | 'success' | 'failure'

function validate(values: Values): Errors {
  const errors: Errors = {}
  if (!values.name.trim()) errors.name = 'Enter a project name'
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = 'Enter a valid email address'
  if (!values.terms) errors.terms = 'You must accept the terms to continue'
  return errors
}

const stack = { display: 'grid', gap: 'var(--space-lg)', maxWidth: '32rem' } as const

function NewProjectPage({ onSubmit }: { onSubmit: (values: Values) => Promise<void> }) {
  const [values, setValues] = useState<Values>({
    name: '',
    email: '',
    plan: 'free',
    notes: '',
    terms: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>('idle')
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      ;(event.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    setStatus('pending')
    try {
      await onSubmit(values)
      setStatus('success')
    } catch {
      setStatus('failure')
    }
  }

  return (
    <div style={stack}>
      <PageHeader title="New project" />
      {status === 'success' && (
        <Card>
          <p role="status">Project created.</p>
        </Card>
      )}
      {status === 'failure' && (
        <Card>
          <p role="alert">We could not create the project. Your input is kept — try again.</p>
        </Card>
      )}
      <form onSubmit={submit} noValidate style={stack} aria-label="New project">
        <Field label="Name" required error={errors.name}>
          {(control) => (
            <Input
              {...control}
              name="name"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
            />
          )}
        </Field>
        <Field label="Email" required hint="We send the receipt here" error={errors.email}>
          {(control) => (
            <Input
              {...control}
              name="email"
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
            />
          )}
        </Field>
        <Field label="Plan">
          {(control) => (
            <Select
              {...control}
              name="plan"
              value={values.plan}
              onChange={(e) => set('plan', e.target.value)}
            >
              <option value="free">Free</option>
              <option value="team">Team</option>
            </Select>
          )}
        </Field>
        <Field label="Notes" hint="Optional">
          {(control) => (
            <Textarea
              {...control}
              name="notes"
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          )}
        </Field>
        <Checkbox
          name="terms"
          label="I accept the terms"
          checked={values.terms}
          onChange={(e) => set('terms', e.target.checked)}
          error={errors.terms}
        />
        <div>
          <Button type="submit" loading={status === 'pending'} loadingLabel="Creating">
            Create project
          </Button>
        </div>
      </form>
    </div>
  )
}

const meta = {
  title: 'Patterns/Form page',
  component: NewProjectPage,
  args: { onSubmit: fn(async () => undefined) },
} satisfies Meta<typeof NewProjectPage>
export default meta
// 스토리가 plain 함수로 args 를 덮어쓸 수 있게 컴포넌트 props 로 타입을 잡는다
type Story = StoryObj<typeof NewProjectPage>

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('form', { name: 'New project' })).toBeVisible()
    await expect(canvas.getByLabelText(/Name/)).toHaveValue('')
  },
}

export const ValidationErrors: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create project' }))
    await expect(canvas.getAllByRole('alert')).toHaveLength(3)
    // 첫 오류 칸으로 포커스가 가고, 오류가 입력칸에 이어진다
    const name = canvas.getByLabelText(/Name/)
    await expect(name).toHaveFocus()
    await expect(name).toHaveAccessibleDescription('Enter a project name')
    await expect(canvas.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true')
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitsAndSucceeds: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Name/), 'Acme')
    await userEvent.type(canvas.getByLabelText(/Email/), 'team@acme.dev')
    await userEvent.selectOptions(canvas.getByLabelText('Plan'), 'team')
    await userEvent.click(canvas.getByRole('checkbox', { name: 'I accept the terms' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create project' }))
    await expect(await canvas.findByRole('status')).toHaveTextContent('Project created.')
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'Acme',
      email: 'team@acme.dev',
      plan: 'team',
      notes: '',
      terms: true,
    })
  },
}

export const Pending: Story = {
  args: { onSubmit: () => new Promise<void>(() => undefined) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Name/), 'Acme')
    await userEvent.type(canvas.getByLabelText(/Email/), 'team@acme.dev')
    await userEvent.click(canvas.getByRole('checkbox', { name: 'I accept the terms' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create project' }))
    const button = await canvas.findByRole('button', { name: /Create project/ })
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'))
    await expect(button).toBeDisabled()
  },
}

export const FailsAndKeepsInput: Story = {
  args: {
    onSubmit: async () => {
      throw new Error('boom')
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Name/), 'Acme')
    await userEvent.type(canvas.getByLabelText(/Email/), 'team@acme.dev')
    await userEvent.click(canvas.getByRole('checkbox', { name: 'I accept the terms' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create project' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'We could not create the project',
    )
    await expect(canvas.getByLabelText(/Name/)).toHaveValue('Acme')
    await expect(canvas.getByRole('button', { name: 'Create project' })).toBeEnabled()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create project' }))
    await expect(canvas.getAllByRole('alert')).toHaveLength(3)
  },
}
