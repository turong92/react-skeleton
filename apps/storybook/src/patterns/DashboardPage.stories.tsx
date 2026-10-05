import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  Stat,
  Table,
  type TableColumn,
} from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

/*
 * 대시보드 화면 틀 — 인사 + 주요 액션 · 숫자 4칸(Stat) · 「최근 항목」 표(상태는 Badge) · 「읽지 않은 알림」 옆 카드. 로딩 · 오류(다시 시도) · 처음 쓰는 사람의 빈 상태.
 * 복사해서 쓸 때: `DashboardState` 는 `useQuery` 결과에서 만든다(isPending → loading, isError → error, data → ready).
 * 숫자 칸 · 표 · 알림은 한 화면의 데이터라 한 번에 가져와 한 상태로 다룬다. 비었을 때는 「왜 비었고 다음에 무엇을 하는가」를 말한다(`EmptyState` 의 `action`).
 * 칸 격자는 auto-fit 이라 좁은 화면에서 저절로 줄어든다. 표와 알림 카드는 flex-wrap 으로 좁은 화면에서 위아래로 쌓인다.
 */
type Item = {
  id: string
  title: string
  status: 'Draft' | 'Active' | 'Archived'
  updatedAt: string
}
type Alert = { id: string; title: string; when: string }
type Dashboard = {
  stats: { total: number; active: number; drafts: number; attachments: number }
  recent: Item[]
  unread: Alert[]
}
type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Dashboard }

const TONE = { Draft: 'warning', Active: 'success', Archived: 'neutral' } as const
const columns: TableColumn<Item>[] = [
  { key: 'title', header: 'Title', render: (row) => row.title, rowHeader: true },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={TONE[row.status]}>{row.status}</Badge>,
  },
  { key: 'updatedAt', header: 'Updated', render: (row) => row.updatedAt, align: 'end' },
]

const stack = { display: 'grid', gap: 'var(--space-lg)' } as const
const stats = {
  display: 'grid',
  gap: 'var(--space-md)',
  gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
} as const
const split = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-lg)',
  alignItems: 'start',
} as const

function DashboardPage(props: {
  state: DashboardState
  onCreate: () => void
  onRetry: () => void
  onOpenInbox: () => void
}) {
  const { state, onCreate, onRetry, onOpenInbox } = props
  const create = <Button onClick={onCreate}>New note</Button>
  return (
    <div style={stack}>
      <PageHeader
        title="Good morning, Sumin"
        description="Here is what is happening in your notes."
        actions={create}
      />
      {state.status === 'loading' && <Spinner label="Loading your dashboard" />}
      {state.status === 'error' && (
        <Card title="Could not load your dashboard">
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
          <div style={stats}>
            <Stat label="Notes" value={state.data.stats.total} />
            <Stat label="Active" value={state.data.stats.active} tone="accent" />
            <Stat
              label="Drafts"
              value={state.data.stats.drafts}
              tone="warning"
              hint="Not published yet"
            />
            <Stat label="With files" value={state.data.stats.attachments} />
          </div>
          <div style={split}>
            <div style={{ flex: '2 1 28rem', minWidth: 0 }}>
              {/* 표는 이미 자기 면과 제목(caption)이 있다 — Card 로 한 번 더 감싸면 테두리가 겹친다 */}
              <Table
                caption="Recent notes"
                columns={columns}
                rows={state.data.recent}
                rowKey={(row) => row.id}
                empty={
                  <EmptyState
                    headingLevel={2} // 표는 Card 안이 아니라 페이지 제목(h1) 바로 아래 단계
                    title="No notes yet"
                    description="Write your first note — it shows up here."
                    action={create}
                  />
                }
              />
            </div>
            <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
              <Card
                title="Unread notifications"
                actions={
                  <Button variant="ghost" size="sm" onClick={onOpenInbox}>
                    Open inbox
                  </Button>
                }
              >
                {state.data.unread.length === 0 ? (
                  <EmptyState
                    headingLevel={3}
                    title="You are all caught up"
                    description="New activity shows up here."
                  />
                ) : (
                  <ul style={{ ...stack, listStyle: 'none', margin: 0, padding: 0 }}>
                    {state.data.unread.slice(0, 3).map((alert) => (
                      <li key={alert.id}>
                        <strong>{alert.title}</strong>
                        <br />
                        <small>{alert.when}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const data: Dashboard = {
  stats: { total: 12, active: 7, drafts: 4, attachments: 3 },
  recent: [
    { id: 'n1', title: 'Quarterly plan', status: 'Active', updatedAt: '10 min ago' },
    { id: 'n2', title: 'Meeting notes', status: 'Draft', updatedAt: 'Yesterday' },
    { id: 'n3', title: 'Reading list', status: 'Archived', updatedAt: 'Last week' },
  ],
  unread: [
    { id: 'a1', title: 'Export finished', when: '2 min ago' },
    { id: 'a2', title: 'Note created', when: '1 hour ago' },
    { id: 'a3', title: 'Note updated', when: 'Yesterday' },
    { id: 'a4', title: 'Fourth is not shown', when: 'Yesterday' },
  ],
}

const meta = {
  title: 'Patterns/Dashboard page',
  component: DashboardPage,
  args: {
    state: { status: 'ready', data },
    onCreate: fn(),
    onRetry: fn(),
    onOpenInbox: fn(),
  },
} satisfies Meta<typeof DashboardPage>
export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Good morning, Sumin' }),
    ).toBeVisible()
    await expect(canvas.getAllByRole('term')).toHaveLength(4)
    await expect(canvas.getByRole('table', { name: 'Recent notes' })).toBeVisible()
    await expect(canvas.getAllByRole('row')).toHaveLength(4) // 머리글 + 3행
    await expect(canvas.getByText('Active', { selector: 'span' })).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3) // 알림은 3건까지
    await userEvent.click(canvas.getByRole('button', { name: 'New note' }))
    await expect(args.onCreate).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Open inbox' }))
    await expect(args.onOpenInbox).toHaveBeenCalledTimes(1)
  },
}

export const Empty: Story = {
  args: {
    state: {
      status: 'ready',
      data: { stats: { total: 0, active: 0, drafts: 0, attachments: 0 }, recent: [], unread: [] },
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'No notes yet' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'You are all caught up' })).toBeVisible()
    await userEvent.click(canvas.getAllByRole('button', { name: 'New note' })[1])
    await expect(args.onCreate).toHaveBeenCalledTimes(1)
  },
}

export const Loading: Story = {
  args: { state: { status: 'loading' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading your dashboard')
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

/** 다크에서도 같은 화면 — 대비(a11y)가 다크에서도 검사된다 */
export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(canvas.getByRole('table', { name: 'Recent notes' })).toBeVisible()
  },
}
