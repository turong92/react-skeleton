import { Button, Card, Dialog, EmptyState, Spinner, Tabs } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, screen, waitFor } from 'storybook/test'

/*
 * 상세 화면 틀 — 제목 + 액션 · 탭(개요 / 활동) · 위험 구역(삭제는 확인 대화상자) · 로딩 · 없음.
 * 복사해서 쓸 때: `DetailState` 는 `useQuery` 결과에서 만든다(404 는 notFound). 삭제 확인은 `Dialog` 의 footer 에 두 버튼.
 * 대화상자를 닫으면 포커스가 연 버튼으로 돌아온다(브라우저가 한다).
 */
type Project = { name: string; owner: string; createdAt: string; activity: string[] }
type DetailState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'ready'; project: Project }

const stack = { display: 'grid', gap: 'var(--space-lg)' } as const
const toolbar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const

function ProjectDetailPage({
  state,
  onDelete,
  onBack,
}: {
  state: DetailState
  onDelete: () => void
  onBack: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  if (state.status === 'loading') return <Spinner label="Loading project" />
  if (state.status === 'notFound')
    return (
      <EmptyState
        headingLevel={2}
        title="Project not found"
        description="It may have been deleted, or the link is wrong."
        action={<Button onClick={onBack}>Back to projects</Button>}
      />
    )
  const { project } = state
  return (
    <div style={stack}>
      <div style={toolbar}>
        <h1>{project.name}</h1>
        <Button variant="secondary" onClick={onBack}>
          Back to projects
        </Button>
      </div>
      <Tabs
        aria-label="Project sections"
        items={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <Card title="Details">
                <dl style={stack}>
                  <div>
                    <dt>Owner</dt>
                    <dd>{project.owner}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{project.createdAt}</dd>
                  </div>
                </dl>
              </Card>
            ),
          },
          {
            id: 'activity',
            label: 'Activity',
            content: (
              <Card title="Recent activity">
                <ul>
                  {project.activity.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Card>
            ),
          },
        ]}
      />
      <Card title="Danger zone">
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete project
        </Button>
      </Card>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete ${project.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onDelete()
                setConfirming(false)
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>This cannot be undone.</p>
      </Dialog>
    </div>
  )
}

const project: Project = {
  name: 'Acme website',
  owner: 'Sumin',
  createdAt: '2026-01-01',
  activity: ['Deployed to production', 'Invited Dana', 'Created the project'],
}

const meta = {
  title: 'Patterns/Detail page',
  component: ProjectDetailPage,
  args: { state: { status: 'ready', project }, onDelete: fn(), onBack: fn() },
} satisfies Meta<typeof ProjectDetailPage>
export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Acme website' })).toBeVisible()
    await expect(canvas.getByText('Sumin')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Activity' }))
    await expect(canvas.getByText('Deployed to production')).toBeVisible()
  },
}

export const DeleteNeedsConfirmation: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Delete project' })
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(args.onDelete).not.toHaveBeenCalled()
    await expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await expect(args.onDelete).toHaveBeenCalledTimes(1)
  },
}

export const Loading: Story = {
  args: { state: { status: 'loading' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading project')
  },
}

export const NotFound: Story = {
  args: { state: { status: 'notFound' } },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'Project not found' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back to projects' }))
    await expect(args.onBack).toHaveBeenCalledTimes(1)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible()
  },
}
