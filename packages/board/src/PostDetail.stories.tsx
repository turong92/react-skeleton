import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { PostDetail } from './PostDetail'
import { ReactionBar } from './ReactionBar'
import { detail } from './test/fixtures'

/**
 * 글 한 건 — 제목 · 알약(고정 · 상태) · 작성 시각 · 조회수 · 본문 · 반응 자리(`reactions`) · 주인의 수정/삭제 · 운영자의 숨김/고정.
 * 단추는 콜백을 주어야 생긴다(삭제는 확인 대화상자를 부모가 띄운다 — Patterns/Detail page). 반응 줄은 `ReactionBar` 를 `reactions` 에 꽂는다.
 */
const post = detail(1, {
  title: 'How do you organize your notes?',
  body: 'I keep everything in one folder.\nWhat about you?',
  viewCount: 42,
  attachmentCount: 2,
})

const meta = {
  title: 'Packages/board/PostDetail',
  component: PostDetail,
  args: { post, formatTime: () => '2026-01-01 12:00' },
} satisfies Meta<typeof PostDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { name: 'How do you organize your notes?' }),
    ).toBeVisible()
    await expect(canvas.getByText(/I keep everything in one folder\./)).toBeVisible()
    await expect(canvas.getByText('2026-01-01 12:00')).toBeVisible()
    await expect(canvas.getByText('Views: 42')).toBeVisible()
    await expect(canvas.getByText('Attachments: 2')).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull() // 콜백이 없으면 단추도 없다
  },
}

export const OwnerActions: Story = {
  args: { onEdit: fn(), onDelete: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    await expect(args.onEdit).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    await expect(args.onDelete).toHaveBeenCalled()
  },
}

export const ModeratorActions: Story = {
  args: { onModerate: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Pin' }))
    await expect(args.onModerate).toHaveBeenLastCalledWith({ pinned: true })
    await userEvent.click(canvas.getByRole('button', { name: 'Hide' }))
    await expect(args.onModerate).toHaveBeenLastCalledWith({ status: 'HIDDEN' })
  },
}

export const PinnedAndHiddenOffersTheOpposites: Story = {
  args: {
    post: { ...post, pinned: true, status: 'HIDDEN' },
    onModerate: fn(),
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByText('Pinned')).toBeVisible()
    await expect(canvas.getByText('Hidden')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Unpin' }))
    await expect(args.onModerate).toHaveBeenLastCalledWith({ pinned: false })
    await userEvent.click(canvas.getByRole('button', { name: 'Restore' }))
    await expect(args.onModerate).toHaveBeenLastCalledWith({ status: 'PUBLISHED' })
  },
}

export const WithReactionBar: Story = {
  args: {
    reactions: (
      <ReactionBar
        types={['LIKE', 'DISLIKE', 'EMPATHY']}
        counts={{ LIKE: 3, EMPATHY: 7 }}
        mine={['EMPATHY']}
        labels={{ LIKE: '좋아요', DISLIKE: '싫어요', EMPATHY: '공감' }}
        onToggle={fn()}
      />
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '공감 7' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

export const KoreanLabels: Story = {
  args: {
    onEdit: fn(),
    labels: { edit: '수정', views: (n: number) => `조회 ${n}` },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '수정' })).toBeVisible()
    await expect(canvas.getByText('조회 42')).toBeVisible()
  },
}

export const LongBodyInANarrowColumn: Story = {
  args: { post: { ...post, title: 'T'.repeat(120), body: 'word '.repeat(300) } },
  render: (args) => (
    <div style={{ maxWidth: '22rem' }}>
      <PostDetail {...args} />
    </div>
  ),
  play: async () => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { onEdit: fn() },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeVisible()
  },
}

/** 제목 아래 작성자 — 닉네임(+ 설정에 따라 꼬리표), 탈퇴했으면 「탈퇴한 사용자」. 계정 id 는 그리지 않는다 */
export const Author: Story = {
  args: {
    post: { ...post, authorId: 'acc_317e90ab', authorName: '수민', authorTag: '4821' },
    authorTag: 'always',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('수민')).toBeVisible()
    await expect(canvas.getByText('#4821')).toBeVisible()
    await expect(document.body.innerHTML).not.toContain('acc_')
  },
}

export const WithdrawnAuthor: Story = {
  args: {
    post: { ...post, authorId: 'deleted:9f2a41c7', authorDeleted: true },
    labels: { authorDeleted: '탈퇴한 사용자' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('탈퇴한 사용자')).toBeVisible()
    await expect(document.body.innerHTML).not.toContain('deleted:')
  },
}
