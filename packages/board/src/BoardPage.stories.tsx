import { Button, Dialog, PageHeader, Spinner } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, screen, waitFor, within } from 'storybook/test'
import type { BoardApi } from './boardApi'
import { BoardComments } from './BoardComments'
import {
  useBoardConfig,
  useCreatePost,
  useModeratePost,
  usePost,
  usePosts,
  useRemovePost,
} from './hooks'
import { PostDetail } from './PostDetail'
import { PostEditor } from './PostEditor'
import { PostList } from './PostList'
import { PostReactionBar } from './PostReactionBar'
import { createFakeBoard, type FakeBoardOptions } from './stories/fakeBoard'
import { WithQuery } from './stories/WithQuery'
import type { PostSort } from './types'

/*
 * 게시판 한 벌을 조립한 모양 — 목록(정렬 · 검색 · 쪽) → 글 상세(반응 · 댓글) → 글쓰기. 라우터 대신 `view` 상태로 화면을 바꾼다.
 * apps/sample 의 「게시판」 화면이 이것을 라우트로 옮긴 것이다. 문구 · 반응 아이콘은 맵으로 주고(`labels` · `icons`) 서버 설정의 종류를 그대로 그린다.
 */
const CODE = 'free'
const REACTION_LABELS = { LIKE: '좋아요', DISLIKE: '싫어요', EMPATHY: '공감' }
const REACTION_ICONS = { LIKE: '👍', DISLIKE: '👎', EMPATHY: '🤝' }

type View = { name: 'list' } | { name: 'detail'; id: number } | { name: 'new' }

function Detail({ api, id, onBack }: { api: BoardApi; id: number; onBack: () => void }) {
  const config = useBoardConfig(api)
  const post = usePost(api, CODE, id)
  const moderate = useModeratePost(api, CODE, id)
  const remove = useRemovePost(api, CODE)
  const [confirming, setConfirming] = useState(false)
  if (!config.data || !post.data) return <Spinner />
  return (
    <>
      <Button variant="ghost" onClick={onBack}>
        ← Posts
      </Button>
      <PostDetail
        post={post.data}
        onModerate={config.data.canModerate ? (m) => moderate.mutate(m) : undefined}
        onDelete={() => setConfirming(true)}
        reactions={
          <PostReactionBar
            api={api}
            boardCode={CODE}
            post={post.data}
            config={config.data}
            labels={REACTION_LABELS}
            icons={REACTION_ICONS}
          />
        }
      />
      <BoardComments
        api={api}
        boardCode={CODE}
        postId={id}
        config={config.data}
        currentUserId="me"
        reactionLabels={REACTION_LABELS}
        reactionIcons={REACTION_ICONS}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this post?"
        footer={
          <Button
            variant="danger"
            onClick={() => remove.mutateAsync(id).then(() => (setConfirming(false), onBack()))}
          >
            Delete post
          </Button>
        }
      >
        <p>The post disappears from the list.</p>
      </Dialog>
    </>
  )
}

function Editor({ api, onDone }: { api: BoardApi; onDone: (id: number | null) => void }) {
  const config = useBoardConfig(api)
  const create = useCreatePost(api, CODE)
  if (!config.data) return <Spinner />
  return (
    <PostEditor
      limits={config.data}
      submitting={create.isPending}
      onCancel={() => onDone(null)}
      onSubmit={async (values) => onDone((await create.mutateAsync({ input: values })).id)}
    />
  )
}

function ListView({
  api,
  onOpen,
  onNew,
}: {
  api: BoardApi
  onOpen: (id: number) => void
  onNew: () => void
}) {
  const [sort, setSort] = useState<PostSort>('latest')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const posts = usePosts(api, CODE, { sort, q, page, size: 10 })
  return (
    <PostList
      posts={posts.data?.values ?? []}
      loading={posts.isPending}
      error={posts.isError}
      onRetry={() => void posts.refetch()}
      page={page}
      totalPages={posts.data?.pagination.totalPages ?? 0}
      onPageChange={setPage}
      sort={sort}
      onSortChange={(next) => (setSort(next), setPage(0))}
      query={q}
      onSearch={(next) => (setQ(next), setPage(0))}
      renderTitle={(post) => (
        <Button variant="ghost" size="sm" onClick={() => onOpen(post.id)}>
          {post.title}
        </Button>
      )}
      formatTime={() => '2026-01-01'}
      actions={<Button onClick={onNew}>Write a post</Button>}
      emptyAction={<Button onClick={onNew}>Write the first post</Button>}
    />
  )
}

function BoardApp({ fake }: { fake?: FakeBoardOptions }) {
  const [board] = useState(() =>
    createFakeBoard({ types: ['LIKE', 'DISLIKE', 'EMPATHY'], ...fake }),
  )
  const [view, setView] = useState<View>({ name: 'list' })
  const list = () => setView({ name: 'list' })
  return (
    <WithQuery>
      <PageHeader title="Free board" />
      {view.name === 'list' && (
        <ListView
          api={board.api}
          onOpen={(id) => setView({ name: 'detail', id })}
          onNew={() => setView({ name: 'new' })}
        />
      )}
      {view.name === 'detail' && <Detail api={board.api} id={view.id} onBack={list} />}
      {view.name === 'new' && (
        <Editor
          api={board.api}
          onDone={(id) => (id !== null ? setView({ name: 'detail', id }) : list())}
        />
      )}
    </WithQuery>
  )
}

const meta = {
  title: 'Packages/board/Board page',
  component: BoardApp,
} satisfies Meta<typeof BoardApp>
export default meta
type Story = StoryObj<typeof meta>

const rowOf = (root: HTMLElement, title: string) =>
  within(within(root).getByRole('button', { name: title }).closest('tr') as HTMLElement)

export const BrowseReadReactAndComeBack: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole('table', { name: 'Posts' })
    const rows = canvas.getAllByRole('row')
    await expect(within(rows[1]).getByText('Welcome to the board')).toBeVisible() // 고정 글이 맨 위
    await expect(within(rows[1]).getByText('Pinned')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Tabs or spaces?' }))
    await expect(await canvas.findByRole('heading', { name: 'Tabs or spaces?' })).toBeVisible()
    await expect(canvas.getByText(/The eternal question/)).toBeVisible()

    // 프로젝트가 더한 「공감」이 서버 설정의 종류라는 이유만으로 보인다
    const group = within(canvas.getByRole('article')) // 글의 반응 줄(아래 댓글의 줄이 아니라)
    await userEvent.click(group.getByRole('button', { name: '공감 0' }))
    await expect(group.getByRole('button', { name: '공감 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(canvas.getByRole('button', { name: '← Posts' }))
    // 목록의 같은 글도 반응 1 개 — 한 번의 누름이 상세와 목록 캐시에 같이 반영된다
    await canvas.findByRole('table')
    const [, , reactions] = rowOf(canvasElement, 'Tabs or spaces?').getAllByRole('cell') // 작성자 · 댓글 · 반응 · 조회 · 날짜
    await expect(reactions).toHaveTextContent('1')
  },
}

export const WriteAPost: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('table', { name: 'Posts' })
    await userEvent.click(canvas.getByRole('button', { name: 'Write a post' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(canvas.getByText('Enter a title.')).toBeVisible()
    await userEvent.type(canvas.getByLabelText(/Title/), 'My first post')
    await userEvent.type(canvas.getByLabelText(/Body/), 'Hello board')
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }))
    await expect(await canvas.findByRole('heading', { name: 'My first post' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '← Posts' }))
    const rows = await waitFor(() => {
      const found = canvas.getAllByRole('row')
      expect(within(found[2]).getByText('My first post')).toBeVisible() // 고정 글 다음이 새 글
      return found
    })
    await expect(rows).toHaveLength(5)
  },
}

export const SearchNarrowsTheList: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('table', { name: 'Posts' })
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search' }), 'tabs{Enter}')
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(2))
    await expect(canvas.getByRole('button', { name: 'Tabs or spaces?' })).toBeVisible()
  },
}

export const ModeratorPinsAPost: Story = {
  args: { fake: { canModerate: true } },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('table', { name: 'Posts' })
    await userEvent.click(canvas.getByRole('button', { name: 'How do you organize your notes?' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Pin' }))
    await expect(await canvas.findByText('Pinned')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '← Posts' }))
    await waitFor(() =>
      expect(within(canvas.getAllByRole('row')[1]).getAllByText('Pinned')).toHaveLength(1),
    )
    await expect(screen.queryByRole('dialog')).toBeNull()
  },
}
