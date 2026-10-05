import {
  Button,
  Card,
  EmptyState,
  Pagination,
  Spinner,
  Table,
  type TableColumn,
} from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'

/*
 * 목록 화면 틀 — 표 + 쪽 이동 + 빈 상태 + 로딩 + 오류(다시 시도).
 * 복사해서 쓸 때: `ListState` 는 `useQuery` 결과에서 만든다(isPending → loading, isError → error, data → ready).
 * 쪽은 0 부터(백엔드 `PaginationMeta.page`). 화면 문구는 앱의 것으로 바꾼다. 날 `<button>` 대신 부품만 쓴다.
 */
type Project = { id: string; name: string; owner: string; stars: number }
type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: Project[]; page: number; totalPages: number }

const columns: TableColumn<Project>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name, rowHeader: true },
  { key: 'owner', header: 'Owner', render: (row) => row.owner },
  { key: 'stars', header: 'Stars', render: (row) => row.stars, align: 'end' },
]

const stack = { display: 'grid', gap: 'var(--space-lg)' } as const
const toolbar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const

function ProjectsPage(props: {
  state: ListState
  onPageChange: (page: number) => void
  onRetry: () => void
  onCreate: () => void
}) {
  const { state, onPageChange, onRetry, onCreate } = props
  const create = <Button onClick={onCreate}>Create project</Button>
  return (
    <div style={stack}>
      <div style={toolbar}>
        <h1>Projects</h1>
        {create}
      </div>
      {state.status === 'loading' && <Spinner label="Loading projects" />}
      {state.status === 'error' && (
        <Card title="Could not load projects">
          <div role="alert" style={stack}>
            <p>{state.message}</p>
            <div>
              <Button variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            </div>
          </div>
        </Card>
      )}
      {state.status === 'ready' && (
        <>
          <Table
            caption="Projects"
            columns={columns}
            rows={state.rows}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                headingLevel={2} // 페이지 제목(h1) 바로 아래 단계
                title="No projects yet"
                description="Create your first project to see it here."
                action={create}
              />
            }
          />
          <Pagination page={state.page} totalPages={state.totalPages} onPageChange={onPageChange} />
        </>
      )}
    </div>
  )
}

const ALL: Project[] = Array.from({ length: 23 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Project ${i + 1}`,
  owner: i % 2 === 0 ? 'Sumin' : 'Dana',
  stars: (i * 7) % 40,
}))
const pageOf = (page: number): ListState => ({
  status: 'ready',
  rows: ALL.slice(page * 10, page * 10 + 10),
  page,
  totalPages: Math.ceil(ALL.length / 10),
})

const meta = {
  title: 'Patterns/List page',
  component: ProjectsPage,
  args: {
    state: pageOf(0),
    onPageChange: fn(),
    onRetry: fn(),
    onCreate: fn(),
  },
} satisfies Meta<typeof ProjectsPage>
export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible()
    await expect(canvas.getByRole('table', { name: 'Projects' })).toBeVisible()
    await expect(canvas.getAllByRole('row')).toHaveLength(11) // 머리글 + 10행
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }))
    await expect(args.onPageChange).toHaveBeenCalledWith(1)
  },
}

export const LastPage: Story = {
  args: { state: pageOf(2) },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('row')).toHaveLength(4) // 머리글 + 3행
    await expect(canvas.getByRole('button', { name: 'Next page' })).toBeDisabled()
  },
}

export const Empty: Story = {
  args: { state: { status: 'ready', rows: [], page: 0, totalPages: 0 } },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
    await expect(canvas.queryByRole('navigation')).toBeNull() // 한 쪽도 없으면 쪽 이동을 그리지 않는다
    await userEvent.click(canvas.getAllByRole('button', { name: 'Create project' })[1])
    await expect(args.onCreate).toHaveBeenCalledTimes(1)
  },
}

export const Loading: Story = {
  args: { state: { status: 'loading' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading projects')
    await expect(canvas.queryByRole('table')).toBeNull()
  },
}

export const ErrorWithRetry: Story = {
  args: { state: { status: 'error', message: 'The server did not answer in time.' } },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('The server did not answer in time.')
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalledTimes(1)
  },
}

function PagingDemo() {
  const [page, setPage] = useState(0)
  return (
    <ProjectsPage
      state={pageOf(page)}
      onPageChange={setPage}
      onRetry={() => undefined}
      onCreate={() => undefined}
    />
  )
}

/** 쪽 이동이 실제로 행을 바꾸는 흐름 */
export const Paging: Story = {
  render: () => <PagingDemo />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('rowheader', { name: 'Project 1' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Page 3' }))
    await expect(canvas.getByRole('rowheader', { name: 'Project 21' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Page 3' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}

/** 다크에서도 같은 화면 — 대비(a11y)가 다크에서도 검사된다 */
export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByRole('table', { name: 'Projects' })).toBeVisible()
  },
}
