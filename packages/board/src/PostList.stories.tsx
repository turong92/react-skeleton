import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { PostList } from './PostList'
import { summary } from './test/fixtures'

/**
 * 글 목록 — 정렬 · 검색 · 쪽 이동 · 고정 글 표시 · 댓글/반응/조회 수 · 비었을 때 · 불러오는 중 · 오류(다시 시도).
 * 보이기만 한다: 조건(`sort` · `query` · `page`)은 주소 같은 곳에서 부모가 쥐고 콜백으로 바꾼다. 글 링크는 `renderTitle` 로(라우터의 `Link`).
 */
const posts = [
  summary(1, {
    title: 'Welcome to the board',
    authorId: 'acc_a1',
    authorName: 'Admin',
    pinned: true,
    commentCount: 2,
    viewCount: 40,
    reactionCounts: { LIKE: 12, EMPATHY: 3 },
  }),
  summary(2, {
    title: 'How do you organize notes?',
    authorId: 'acc_b2',
    authorName: null,
    commentCount: 7,
    viewCount: 9,
  }),
  summary(3, {
    title: 'A draft of mine',
    status: 'DRAFT',
    authorId: 'deleted:7f3a',
    authorDeleted: true,
  }),
]

const meta = {
  title: 'Packages/board/PostList',
  component: PostList,
  args: {
    posts,
    page: 0,
    totalPages: 3,
    sort: 'latest',
    query: '',
    onPageChange: fn(),
    onSortChange: fn(),
    onSearch: fn(),
    renderTitle: (post) => <a href={`#${post.id}`}>{post.title}</a>,
    formatTime: () => '2026-01-01',
  },
} satisfies Meta<typeof PostList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const table = canvas.getByRole('table', { name: 'Posts' })
    const rows = within(table).getAllByRole('row')
    await expect(rows).toHaveLength(4) // 머리글 + 3
    await expect(within(rows[1]).getByText('Pinned')).toBeVisible()
    await expect(within(rows[1]).getByRole('link', { name: 'Welcome to the board' })).toBeVisible()
    await expect(within(rows[1]).getByText('15')).toBeVisible() // 반응 12 + 3
    await expect(within(rows[3]).getByText('Draft')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Page 2' }))
    await expect(args.onPageChange).toHaveBeenCalledWith(1)
    await userEvent.selectOptions(canvas.getByLabelText('Sort by'), 'comments')
    await expect(args.onSortChange).toHaveBeenCalledWith('comments')
  },
}

export const SearchSubmitsOnEnter: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search' }), '  needle {Enter}')
    await expect(args.onSearch).toHaveBeenCalledWith('needle')
  },
}

export const Empty: Story = {
  args: {
    posts: [],
    totalPages: 0,
    actions: undefined,
    emptyAction: <a href="#new">Write the first post</a>,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'No posts yet' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Write the first post' })).toBeVisible()
  },
}

export const NoResults: Story = {
  args: { posts: [], totalPages: 0, query: 'zzz' },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'No posts match' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }))
    await expect(args.onSearch).toHaveBeenCalledWith('')
  },
}

export const Loading: Story = {
  args: { posts: [], loading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading')
    await expect(canvas.queryByRole('table')).toBeNull()
  },
}

export const ErrorWithRetry: Story = {
  args: { posts: [], error: true, onRetry: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'Could not load posts' })).toBeVisible()
    await expect(canvas.getByRole('alert')).toHaveTextContent('Check your connection')
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

export const KoreanLabels: Story = {
  args: {
    labels: {
      caption: '글 목록',
      pinned: '공지',
      sort: '정렬',
      sorts: { latest: '최신순', reactions: '반응순', comments: '댓글순' },
      search: '검색',
      pagination: { label: '쪽 이동', page: (n: number) => `${n}쪽` },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: '글 목록' })).toBeVisible()
    await expect(canvas.getByText('공지')).toBeVisible()
    await expect(canvas.getByRole('option', { name: '반응순' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '2쪽' })).toBeVisible()
  },
}

export const LongTitleInANarrowColumn: Story = {
  args: { posts: [summary(1, { title: 'A very long title '.repeat(12) })] },
  render: (args) => (
    <div style={{ maxWidth: '24rem' }}>
      <PostList {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getByRole('table')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByRole('table', { name: 'Posts' })).toBeVisible()
  },
}

/** 작성자 열 — 닉네임 · 이름 없음 · 탈퇴(계정 id 는 어디에도 없다). 한국어 문구는 `labels` 로 */
export const Authors: Story = {
  args: {
    labels: {
      caption: '글 목록',
      author: '작성자',
      authorDeleted: '탈퇴한 사용자',
      authorUnnamed: '이름 없는 사용자',
    },
    posts: [
      ...posts,
      summary(4, {
        title: '같은 닉네임 첫째',
        authorId: 'acc_x',
        authorName: '수민',
        authorTag: '4821',
      }),
      summary(5, {
        title: '같은 닉네임 둘째',
        authorId: 'acc_y',
        authorName: '수민',
        authorTag: '0097',
      }),
    ],
  },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: '글 목록' })
    await expect(within(table).getByRole('columnheader', { name: '작성자' })).toBeVisible()
    await expect(within(table).getByText('Admin')).toBeVisible()
    await expect(within(table).getByText('이름 없는 사용자')).toBeVisible()
    await expect(within(table).getByText('탈퇴한 사용자')).toBeVisible()
    // 겹치는 닉네임에만 꼬리표
    await expect(within(table).getByText('#4821')).toBeVisible()
    await expect(within(table).getByText('#0097')).toBeVisible()
    await expect(document.body.innerHTML).not.toContain('acc_')
    await expect(document.body.innerHTML).not.toContain('deleted:')
  },
}
