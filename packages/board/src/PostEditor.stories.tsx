import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { PostEditor } from './PostEditor'

/**
 * 글쓰기 · 고치기 폼 — 제목 · 본문. 길이 한도는 서버 설정(`titleMaxLength` · `bodyMaxLength`)에서 오고, 비었거나 넘으면 제출 때 칸 아래에
 * 말하고 첫 오류 칸으로 포커스(Patterns/Form page 와 같다). 보내는 중(`submitting`) · 실패(`error`) · 서버의 칸별 오류(`fieldErrors`)는 부모가 준다.
 */
const meta = {
  title: 'Packages/board/PostEditor',
  component: PostEditor,
  args: {
    limits: { titleMaxLength: 20, bodyMaxLength: 100 },
    onSubmit: fn(async () => undefined),
    onCancel: fn(),
  },
} satisfies Meta<typeof PostEditor>
export default meta
type Story = StoryObj<typeof meta>

export const BlankIsRejectedWithFocusOnTheFirstError: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(canvas.getByText('Enter a title.')).toBeVisible()
    await expect(canvas.getByText('Write something in the body.')).toBeVisible()
    await expect(canvas.getByLabelText(/Title/)).toHaveFocus()
    await expect(canvas.getByLabelText(/Title/)).toHaveAttribute('aria-invalid', 'true')
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const TooLongIsRejected: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Title/), 'x'.repeat(21))
    await userEvent.type(canvas.getByLabelText(/Body/), 'ok')
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(canvas.getByText('Keep the title within 20 characters.')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitsTrimmedValues: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Title/), '  Hello  ')
    await userEvent.type(canvas.getByLabelText(/Body/), 'First line')
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ title: 'Hello', body: 'First line' })
  },
}

export const EditingStartsFilledAndCanCancel: Story = {
  args: { initial: { title: 'Existing', body: 'Existing body' }, submitLabel: 'Save changes' },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByLabelText(/Title/)).toHaveValue('Existing')
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(args.onCancel).toHaveBeenCalled()
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeVisible()
  },
}

export const Submitting: Story = {
  args: { initial: { title: 'T', body: 'B' }, submitting: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Publish/ })).toBeDisabled()
  },
}

export const FailureKeepsTheInput: Story = {
  args: {
    initial: { title: 'T', body: 'B' },
    error: 'We could not save the post. Your text is kept — try again.',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('We could not save the post')
    await expect(canvas.getByLabelText(/Body/)).toHaveValue('B')
  },
}

export const ServerFieldErrorsLandOnTheirFields: Story = {
  args: {
    initial: { title: 'T', body: 'B' },
    fieldErrors: { body: 'The server says the body is not allowed.' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The server says the body is not allowed.')).toBeVisible()
    await expect(canvas.getByLabelText(/Body/)).toHaveAttribute('aria-invalid', 'true')
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByRole('button', { name: 'Publish' })).toBeVisible()
  },
}
