import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn } from 'storybook/test'
import { PostEditor } from './PostEditor'
import { demoAuthorPicker } from './stories/demoAuthorPicker'

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

/** 서버가 `authorRequired` 를 알린 게시판 — 작성자를 고르기 전에는 보내지 못한다. 선택기는 제출 단추 옆(보드는 안쪽을 모른다 — `authorPicker` 렌더 함수) */
export const AuthorRequiredBlocksUntilPicked: Story = {
  args: { authorRequired: true, authorPicker: demoAuthorPicker() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Title/), 'Hello')
    await userEvent.type(canvas.getByLabelText(/Body/), 'First line')
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Choose who to post as.')
    await expect(canvas.getByRole('combobox', { name: 'Post as' })).toHaveFocus()
    // 낭독기가 선택기에서 오류를 읽는다 — 오류 문장이 선택기의 설명으로 이어져 있다
    await expect(canvas.getByRole('combobox', { name: 'Post as' })).toHaveAccessibleDescription(
      'Choose who to post as.',
    )
    await expect(canvas.getByRole('combobox', { name: 'Post as' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Post as' }), 'Ann')
    await expect(canvas.queryByRole('alert')).toBeNull() // 고르면 오류가 사라진다
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({
      title: 'Hello',
      body: 'First line',
      authorId: 'prf_a',
    })
  },
}

/** 서버가 필수로 하지 않으면(`authorRequired` 꺼짐) 선택기를 줘도 그리지 않고, 입력에는 `authorId` 키가 없다(서버는 보낸 `authorId` 를 거절한다) */
export const PickerIsNotDrawnWithoutAuthorRequired: Story = {
  args: { authorPicker: demoAuthorPicker() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.queryByRole('combobox', { name: 'Post as' })).toBeNull()
    await userEvent.type(canvas.getByLabelText(/Title/), 'Hello')
    await userEvent.type(canvas.getByLabelText(/Body/), 'First line')
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ title: 'Hello', body: 'First line' })
  },
}

/** 필수인데 선택기를 꽂지 않았으면 막지 않는다 — 고를 수단이 없는 막다른 길을 만들지 않는다(서버가 `BOARD.AUTHOR_REQUIRED` 로 답한다) */
export const AuthorRequiredWithoutAPickerDoesNotBlock: Story = {
  args: { authorRequired: true },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Title/), 'Hello')
    await userEvent.type(canvas.getByLabelText(/Body/), 'First line')
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ title: 'Hello', body: 'First line' })
  },
}

export const AuthorRequiredMessageIsAProp: Story = {
  args: {
    authorRequired: true,
    authorPicker: demoAuthorPicker([{ id: 'prf_a', name: '하늘' }], '작성자', '고르세요'),
    labels: { authorRequired: '누구로 쓸지 골라 주세요.' },
    initial: { title: 'T', body: 'B' },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('누구로 쓸지 골라 주세요.')
  },
}

/** 보관하는 것은 「작성자를 안 골랐다」는 사실뿐이다 — 문구는 그릴 때 지금의 `labels` 에서 읽는다. 앱이 문구를 바꾸면(예: 프로필을 만들고 돌아와 「골라 주세요」로) 낡은 문장이 남지 않는다 */
function MessageDemo(args: ComponentProps<typeof PostEditor>) {
  const [made, setMade] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setMade(true)}>
        profile made
      </button>
      <PostEditor
        {...args}
        labels={{ authorRequired: made ? '골라 주세요.' : '먼저 만들어 주세요.' }}
      />
    </>
  )
}

export const AuthorMessageFollowsTheCurrentLabels: Story = {
  args: {
    authorRequired: true,
    authorPicker: demoAuthorPicker([{ id: 'prf_a', name: '하늘' }], '작성자', '고르세요'),
    initial: { title: 'T', body: 'B' },
  },
  render: (args) => <MessageDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('먼저 만들어 주세요.')
    await userEvent.click(canvas.getByRole('button', { name: 'profile made' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('골라 주세요.')
    await expect(canvas.queryByText('먼저 만들어 주세요.')).toBeNull()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByRole('button', { name: 'Publish' })).toBeVisible()
  },
}
