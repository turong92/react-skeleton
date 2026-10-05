import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { CommentThread } from './CommentThread'
import { comment, thread } from './test/fixtures'

/**
 * 댓글 한 줄기(최상위 + 대댓글) — 서버가 평평하게 준 자손을 트리로 그린다(`nestThread`).
 * `collapseFromDepth`(기본 2) 이상 깊이의 답글은 「답글 N개 더 보기」 뒤에 접힌다. 지운 · 숨긴 댓글은 자리 표시 문구(`labels`)로 자리를 지킨다.
 * 보이기만 한다 — 데이터 · 호출은 모른다(콜백을 주면 그 단추가 생긴다). 서버와 이어 쓰는 모양은 `BoardComments`.
 */
const root = thread(
  1,
  [
    comment(2, 1, { authorId: 'alice', body: 'First reply', depth: 1 }),
    comment(3, 2, { authorId: 'bob', body: 'Reply to the reply', depth: 2, rootId: 1 }),
    comment(4, 2, { authorId: 'carol', body: 'Another one', depth: 2, rootId: 1 }),
  ],
  { authorId: 'dave', body: 'Top-level comment' },
)

const meta = {
  title: 'Packages/board/CommentThread',
  component: CommentThread,
  args: {
    thread: root,
    maxDepth: 2,
    commentMaxLength: 200,
    reactionTypes: ['LIKE', 'DISLIKE'],
    onReply: fn(async () => undefined),
    onEdit: fn(async () => undefined),
    onDelete: fn(),
    onModerate: fn(),
    onReact: fn(),
  },
} satisfies Meta<typeof CommentThread>
export default meta
type Story = StoryObj<typeof meta>

export const NestedAndCollapsed: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Top-level comment')).toBeVisible()
    await expect(canvas.getByText('First reply')).toBeVisible()
    // 깊이 2 의 답글 둘은 접혀 있다
    await expect(canvas.queryByText('Reply to the reply')).toBeNull()
    const more = canvas.getByRole('button', { name: 'Show 2 more replies' })
    await expect(more).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(more)
    await expect(canvas.getByText('Reply to the reply')).toBeVisible()
    await expect(canvas.getByText('Another one')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Hide replies' }))
    await expect(canvas.queryByText('Another one')).toBeNull()
  },
}

export const CollapseFromDepthIsAProp: Story = {
  args: { collapseFromDepth: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Top-level comment')).toBeVisible()
    await expect(canvas.queryByText('First reply')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Show 3 more replies' })).toBeVisible()
  },
}

export const NeverCollapsed: Story = {
  args: { collapseFromDepth: 99 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Reply to the reply')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /more repl/ })).toBeNull()
  },
}

export const ReplyFlow: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: alice' }))
    const box = canvas.getByRole('textbox', { name: 'Your reply' })
    await expect(box).toHaveFocus()
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Write something first.')
    await userEvent.type(box, '  Thanks!  ')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(args.onReply).toHaveBeenCalledWith(2, 'Thanks!')
    await expect(canvas.queryByRole('textbox', { name: 'Your reply' })).toBeNull() // 보내면 닫힌다
  },
}

export const NoReplyBeyondMaxDepth: Story = {
  args: { collapseFromDepth: 99 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Reply: dave' })).toBeVisible() // 깊이 0
    await expect(canvas.getByRole('button', { name: 'Reply: alice' })).toBeVisible() // 깊이 1
    await expect(canvas.queryByRole('button', { name: 'Reply: bob' })).toBeNull() // 깊이 2 = maxDepth
  },
}

export const OwnCommentsCanBeEditedAndDeleted: Story = {
  args: { currentUserId: 'alice' },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.queryByRole('button', { name: 'Edit: dave' })).toBeNull() // 남의 것
    await userEvent.click(canvas.getByRole('button', { name: 'Edit: alice' }))
    const box = canvas.getByRole('textbox', { name: 'Edit comment' })
    await expect(box).toHaveValue('First reply')
    await userEvent.clear(box)
    await userEvent.type(box, 'Edited reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(args.onEdit).toHaveBeenCalledWith(2, 'Edited reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Delete: alice' }))
    await expect(args.onDelete).toHaveBeenCalledWith(2)
  },
}

export const ModeratorHidesAndRestores: Story = {
  args: {
    canModerate: true,
    thread: thread(
      1,
      [comment(2, 1, { authorId: 'alice', body: null, status: 'HIDDEN', depth: 1 })],
      { authorId: 'dave', body: 'Top-level comment' },
    ),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Hide: dave' }))
    await expect(args.onModerate).toHaveBeenLastCalledWith(1, 'HIDDEN')
    await userEvent.click(canvas.getByRole('button', { name: 'Restore: alice' }))
    await expect(args.onModerate).toHaveBeenLastCalledWith(2, 'PUBLISHED')
  },
}

export const ModerationIsHiddenFromEveryoneElse: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: /^Hide/ })).toBeNull()
  },
}

export const PlaceholdersKeepTheThreadShape: Story = {
  args: {
    collapseFromDepth: 99,
    thread: thread(
      1,
      [
        comment(2, 1, { authorId: 'alice', body: null, status: 'DELETED', depth: 1 }),
        comment(3, 1, { authorId: 'bob', body: null, status: 'HIDDEN', depth: 1 }),
        comment(4, 2, { authorId: 'carol', body: 'Still here', depth: 2, rootId: 1 }),
      ],
      { authorId: 'dave', body: 'Top-level comment' },
    ),
    labels: { deleted: '삭제된 댓글입니다.', hidden: '운영자가 숨긴 댓글입니다.' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('삭제된 댓글입니다.')).toBeVisible()
    await expect(canvas.getByText('운영자가 숨긴 댓글입니다.')).toBeVisible()
    await expect(canvas.getByText('Still here')).toBeVisible() // 지운 댓글의 답글은 남는다
    // 자리 표시 댓글에는 답글 · 반응이 없다
    await expect(canvas.queryByRole('button', { name: 'Reply: alice' })).toBeNull()
  },
}

export const Reactions: Story = {
  args: {
    reactionTypes: ['LIKE', 'EMPATHY'],
    reactionLabels: { EMPATHY: '공감' },
    thread: thread(1, [], {
      authorId: 'dave',
      body: 'Top-level comment',
      reactionCounts: { LIKE: 2, EMPATHY: 4 },
      myReactions: ['EMPATHY'],
    }),
  },
  play: async ({ canvas, args, userEvent }) => {
    const group = within(canvas.getByRole('group', { name: 'Reactions' }))
    await expect(group.getByRole('button', { name: '공감 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(group.getByRole('button', { name: 'LIKE 2' }))
    await expect(args.onReact).toHaveBeenCalledWith(1, 'LIKE', true)
  },
}

export const LongTextInANarrowColumn: Story = {
  args: {
    collapseFromDepth: 99,
    thread: thread(1, [comment(2, 1, { depth: 1, body: 'word '.repeat(60) })], {
      body: 'x'.repeat(200),
    }),
  },
  render: (args) => (
    <div style={{ maxWidth: '20rem' }}>
      <CommentThread {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getAllByRole('button', { name: /^Reply/ }).length).toBeGreaterThan(0)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByText('Top-level comment')).toBeVisible()
  },
}
