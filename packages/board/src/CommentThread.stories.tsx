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
    comment(2, 1, { authorId: 'alice', authorName: 'Alice', body: 'First reply', depth: 1 }),
    comment(3, 2, {
      authorId: 'bob',
      authorName: 'Bob',
      body: 'Reply to the reply',
      depth: 2,
      rootId: 1,
    }),
    comment(4, 2, {
      authorId: 'carol',
      authorName: 'Carol',
      body: 'Another one',
      depth: 2,
      rootId: 1,
    }),
  ],
  { authorId: 'dave', authorName: 'Dave', body: 'Top-level comment' },
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
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Alice' }))
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
    await expect(canvas.getByRole('button', { name: 'Reply: Dave' })).toBeVisible() // 깊이 0
    await expect(canvas.getByRole('button', { name: 'Reply: Alice' })).toBeVisible() // 깊이 1
    await expect(canvas.queryByRole('button', { name: 'Reply: Bob' })).toBeNull() // 깊이 2 = maxDepth
  },
}

export const OwnCommentsCanBeEditedAndDeleted: Story = {
  args: { currentUserId: 'alice' },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.queryByRole('button', { name: 'Edit: Dave' })).toBeNull() // 남의 것
    await userEvent.click(canvas.getByRole('button', { name: 'Edit: Alice' }))
    const box = canvas.getByRole('textbox', { name: 'Edit comment' })
    await expect(box).toHaveValue('First reply')
    await userEvent.clear(box)
    await userEvent.type(box, 'Edited reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(args.onEdit).toHaveBeenCalledWith(2, 'Edited reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Delete: Alice' }))
    await expect(args.onDelete).toHaveBeenCalledWith(2)
  },
}

export const ModeratorHidesAndRestores: Story = {
  args: {
    canModerate: true,
    thread: thread(
      1,
      [
        comment(2, 1, {
          authorId: 'alice',
          authorName: 'Alice',
          body: null,
          status: 'HIDDEN',
          depth: 1,
        }),
      ],
      { authorId: 'dave', authorName: 'Dave', body: 'Top-level comment' },
    ),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Hide: Dave' }))
    await expect(args.onModerate).toHaveBeenLastCalledWith(1, 'HIDDEN')
    await userEvent.click(canvas.getByRole('button', { name: 'Restore: Alice' }))
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
        comment(2, 1, {
          authorId: 'alice',
          authorName: 'Alice',
          body: null,
          status: 'DELETED',
          depth: 1,
        }),
        comment(3, 1, {
          authorId: 'bob',
          authorName: 'Bob',
          body: null,
          status: 'HIDDEN',
          depth: 1,
        }),
        comment(4, 2, {
          authorId: 'carol',
          authorName: 'Carol',
          body: 'Still here',
          depth: 2,
          rootId: 1,
        }),
      ],
      { authorId: 'dave', authorName: 'Dave', body: 'Top-level comment' },
    ),
    labels: { deleted: '삭제된 댓글입니다.', hidden: '운영자가 숨긴 댓글입니다.' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('삭제된 댓글입니다.')).toBeVisible()
    await expect(canvas.getByText('운영자가 숨긴 댓글입니다.')).toBeVisible()
    await expect(canvas.getByText('Still here')).toBeVisible() // 지운 댓글의 답글은 남는다
    // 자리 표시 댓글에는 답글 · 반응이 없다
    await expect(canvas.queryByRole('button', { name: 'Reply: Alice' })).toBeNull()
  },
}

export const Reactions: Story = {
  args: {
    reactionTypes: ['LIKE', 'EMPATHY'],
    reactionLabels: { EMPATHY: '공감' },
    thread: thread(1, [], {
      authorId: 'dave',
      authorName: 'Dave',
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

const koLabels = { authorDeleted: '탈퇴한 사용자', authorUnnamed: '이름 없는 사용자' }

/** 작성자 표시 — 닉네임 · 이름 없음 · 탈퇴. 계정 id 는 화면에도 스크린 리더에도 나오지 않는다 */
export const Authors: Story = {
  args: {
    labels: koLabels,
    collapseFromDepth: 99,
    thread: thread(
      1,
      [
        comment(2, 1, { authorId: 'acc_317e90ab', authorName: null, body: '이름이 없는 계정' }),
        comment(3, 1, {
          authorId: 'deleted:9f2a41c7',
          authorDeleted: true,
          body: '탈퇴한 분의 댓글',
        }),
      ],
      { authorId: 'acc_55d0aa11', authorName: '수민', body: '닉네임이 있는 계정' },
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('수민')).toBeVisible()
    await expect(canvas.getByText('이름 없는 사용자')).toBeVisible()
    await expect(canvas.getByText('탈퇴한 사용자')).toBeVisible()
    // 스크린 리더가 읽는 이름: 단추 이름에 닉네임이 들어가고 id 는 어디에도 없다
    await expect(canvas.getByRole('button', { name: 'Reply: 수민' })).toBeVisible()
    const text = document.body.innerHTML
    await expect(text).not.toContain('acc_')
    await expect(text).not.toContain('deleted:')
    // 아바타는 스크린 리더에서 숨겨져 이름이 한 번만 읽힌다
    await expect(canvas.queryByRole('img', { name: '수민' })).toBeNull()
  },
}

/** 같은 닉네임을 쓰는 두 계정이 한 스레드에 있으면 서버의 꼬리표(`#4821`)가 보인다 — 안 겹치는 사람에게는 붙지 않는다 */
export const SameNicknameShowsTags: Story = {
  args: {
    collapseFromDepth: 99,
    thread: thread(
      1,
      [
        comment(2, 1, {
          authorId: 'acc_b',
          authorName: '수민',
          authorTag: '0097',
          body: '다른 수민',
        }),
        comment(3, 1, {
          authorId: 'acc_c',
          authorName: '민수',
          authorTag: '1234',
          body: '겹치지 않음',
        }),
      ],
      { authorId: 'acc_a', authorName: '수민', authorTag: '4821', body: '첫 수민' },
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('#4821')).toBeVisible()
    await expect(canvas.getByText('#0097')).toBeVisible()
    await expect(canvas.queryByText('#1234')).toBeNull()
  },
}

export const DifferentNicknamesShowNoTags: Story = {
  args: {
    collapseFromDepth: 99,
    thread: thread(
      1,
      [comment(2, 1, { authorId: 'acc_b', authorName: '민수', authorTag: '0097', body: '답글' })],
      { authorId: 'acc_a', authorName: '수민', authorTag: '4821', body: '첫 댓글' },
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/^#\d{4}$/)).toBeNull()
  },
}
