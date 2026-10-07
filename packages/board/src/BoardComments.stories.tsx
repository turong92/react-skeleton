import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { BoardComments } from './BoardComments'
import { createFakeBoard, type FakeBoardOptions } from './stories/fakeBoard'
import { WithQuery } from './stories/WithQuery'

/**
 * 댓글 영역(서버와 이어진 모양) — `api` 하나로 목록(최상위 단위 쪽 · 정렬) · 새 댓글 · 답글 · 수정 · 삭제(확인) · 운영자 숨김 · 반응(낙관적 갱신)을 한다.
 * 여기서는 메모리 안의 가짜 서버(`stories/fakeBoard.ts` — 계약의 규칙을 따른다)가 `api` 다. `config` 는 서버 설정(`useBoardConfig`)의 값.
 */
function Demo({
  fake,
  ...rest
}: {
  fake?: FakeBoardOptions
} & Partial<ComponentProps<typeof BoardComments>>) {
  const [board] = useState(() => createFakeBoard(fake))
  return (
    <WithQuery>
      <BoardComments
        api={board.api}
        boardCode="free"
        postId={3}
        config={board.config}
        currentUserId={fake?.me ?? 'me'}
        formatTime={() => '2026-01-01'}
        {...rest}
      />
    </WithQuery>
  )
}

/** 그 댓글의 반응 줄(자기 것 — 아래 답글의 줄은 제외) */
const reactionsOf = (root: HTMLElement, text: string) =>
  within(
    within(root)
      .getByText(text)
      .closest('[data-status]')!
      .querySelector<HTMLElement>('[role="group"]')!,
  )

const meta = {
  title: 'Packages/board/BoardComments',
  component: Demo,
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const ShowsTheTreeWithPlaceholders: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Spaces, always.')).toBeVisible()
    await expect(canvas.getByText('Tabs — they are accessible.')).toBeVisible()
    await expect(canvas.getByText('This comment was deleted.')).toBeVisible()
    await expect(canvas.getByText('This comment was hidden.')).toBeVisible()
    // 깊이 2 의 답글 둘은 접혀 있다
    await expect(canvas.queryByText('Agree with the formatter.')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Show 2 more replies' })).toBeVisible()
  },
}

export const WriteACommentThenReplyAtEveryLevel: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Write a comment' }),
      'A new top-level one',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(await canvas.findByText('A new top-level one')).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: 'Write a comment' })).toHaveValue('') // 보낸 뒤 비운다

    // 대댓글(깊이 1) — 자리에서 바로 보인다
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Me' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your reply' }), 'A reply of mine')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(await canvas.findByText('A reply of mine')).toBeVisible()

    // 깊이 2 로 답하면 접힌 칸을 펼쳐 새 답글이 보인다
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Bob' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your reply' }), 'Deepest reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(await canvas.findByText('Deepest reply')).toBeVisible()
    // 최대 깊이의 댓글에는 더 답할 수 없다
    await expect(canvas.queryByRole('button', { name: 'Reply: Carol' })).toBeNull()
  },
}

export const ReactionsAreOptimisticAndSingleModeSwitches: Story = {
  args: {
    fake: { types: ['LIKE', 'DISLIKE', 'EMPATHY'], delayMs: 250 },
    reactionLabels: { LIKE: '좋아요', DISLIKE: '싫어요', EMPATHY: '공감' },
    reactionIcons: { LIKE: '👍', DISLIKE: '👎', EMPATHY: '🤝' },
    labels: { reactionGroup: '반응' },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    const first = reactionsOf(canvasElement, 'Spaces, always.')
    await userEvent.click(first.getByRole('button', { name: '공감 0' }))
    // 서버가 답하기 전(250ms)에 이미 눌린 모양 · 개수 1
    await expect(first.getByRole('button', { name: '공감 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // 같은 댓글에서 다른 종류를 누르면(SINGLE) 옮겨 간다 — 새 종류 +1, 이전 종류 -1
    await userEvent.click(first.getByRole('button', { name: '좋아요 0' }))
    await expect(first.getByRole('button', { name: '좋아요 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(first.getByRole('button', { name: '공감 0' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // 서버 응답이 와도 같은 값
    await waitFor(() => expect(first.getByRole('button', { name: '좋아요 1' })).toBeEnabled())
    // 다시 누르면 취소
    await userEvent.click(first.getByRole('button', { name: '좋아요 1' }))
    await expect(first.getByRole('button', { name: '좋아요 0' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  },
}

export const PerTypeModeKeepsSeveralReactions: Story = {
  args: {
    fake: { mode: 'PER_TYPE', types: ['LIKE', 'EMPATHY'] },
    reactionLabels: { EMPATHY: '공감' },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    const first = reactionsOf(canvasElement, 'Spaces, always.')
    await userEvent.click(first.getByRole('button', { name: 'LIKE 0' }))
    await userEvent.click(first.getByRole('button', { name: '공감 0' }))
    await expect(first.getByRole('button', { name: 'LIKE 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(first.getByRole('button', { name: '공감 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

export const AFailedReactionRollsBack: Story = {
  args: { fake: { delayMs: 200, failReactions: true } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    const first = reactionsOf(canvasElement, 'Spaces, always.')
    await userEvent.click(first.getByRole('button', { name: 'LIKE 0' }))
    await expect(first.getByRole('button', { name: 'LIKE 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ) // 낙관적
    await waitFor(() =>
      expect(first.getByRole('button', { name: 'LIKE 0' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    ) // 서버가 거절하자 되돌아간다
  },
}

export const OwnCommentEditThenDeleteWithConfirmation: Story = {
  args: { fake: { me: 'alice' } },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.click(canvas.getByRole('button', { name: 'Edit: Alice' }))
    const box = canvas.getByRole('textbox', { name: 'Edit comment' })
    await userEvent.clear(box)
    await userEvent.type(box, 'Spaces, mostly.')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByText('Spaces, mostly.')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Delete: Alice' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this comment?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await expect(canvas.getByText('Spaces, mostly.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Delete: Alice' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() => expect(canvas.queryByText('Spaces, mostly.')).toBeNull())
    await expect(canvas.getAllByText('This comment was deleted.')).toHaveLength(2) // 지운 자리는 남는다
  },
}

export const ModeratorHidesAndRestores: Story = {
  args: { fake: { canModerate: true } },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.click(canvas.getByRole('button', { name: 'Hide: Alice' }))
    await waitFor(() => expect(canvas.queryByText('Spaces, always.')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: 'Restore: Alice' }))
    await expect(await canvas.findByText('Spaces, always.')).toBeVisible()
  },
}

export const NoModeratorButtonsForEveryoneElse: Story = {
  play: async ({ canvas }) => {
    await canvas.findByText('Spaces, always.')
    await expect(canvas.queryByRole('button', { name: /^(Hide|Restore)/ })).toBeNull()
  },
}

export const EmptyPost: Story = {
  args: { postId: 1 },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No comments yet.')).toBeVisible()
  },
}

export const Loading: Story = {
  args: { fake: { delayMs: 800 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading')
    await expect(await canvas.findByText('Spaces, always.')).toBeVisible()
  },
}

export const KoreanLabels: Story = {
  args: {
    labels: {
      heading: '댓글',
      newComment: '댓글 쓰기',
      postComment: '댓글 등록',
      deleted: '삭제된 댓글입니다.',
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByText('Spaces, always.')
    await expect(canvas.getByRole('heading', { name: '댓글' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '댓글 등록' })).toBeVisible()
    await expect(canvas.getByText('삭제된 댓글입니다.')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(await canvas.findByText('Spaces, always.')).toBeVisible()
  },
}

/** `beforeWrite` — 쓰기 직전에 앱이 막을 수 있다(예: 닉네임이 없으면 먼저 정하게). false 면 보내지 않고 쓴 글은 그대로 남는다 */
export const BeforeWriteCanBlockAndKeepsTheText: Story = {
  args: { beforeWrite: fn(() => false) },
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByText('Spaces, always.')
    const field = canvas.getByRole('textbox', { name: 'Write a comment' })
    await userEvent.type(field, 'Held back')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await waitFor(() => expect(args.beforeWrite).toHaveBeenCalled())
    await expect(field).toHaveValue('Held back')
    await expect(canvas.queryByText('Held back', { selector: 'p' })).toBeNull()
    // 답글도 같다
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Alice' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your reply' }), 'Held reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(args.beforeWrite).toHaveBeenCalledTimes(2)
    await expect(canvas.getByRole('textbox', { name: 'Your reply' })).toHaveValue('Held reply')
  },
}

export const BeforeWriteThatAllowsPostsAsUsual: Story = {
  args: { beforeWrite: fn(() => true) },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Write a comment' }), 'Allowed one')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(await canvas.findByText('Allowed one')).toBeVisible()
  },
}

/** 한 쪽의 모든 댓글 줄기를 한 범위로 본다 — `AuthorScope` 로 감싸지 않아도 줄기가 달라도(같은 닉네임 · 다른 계정) 꼬리표가 붙는다 */
export const SameNicknameAcrossThreadsOfOnePageShowsTags: Story = {
  args: {
    fake: {
      nicknames: { alice: 'Sumin', erin: 'sumin', bob: 'Bob' },
      tags: { alice: '0001', erin: '0002', bob: '0003' },
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByText('Spaces, always.')
    await expect(canvas.getAllByText('#0001').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('#0002').length).toBeGreaterThan(0)
    await expect(canvas.queryByText('#0003')).toBeNull() // Bob 은 겹치지 않는다
  },
}
