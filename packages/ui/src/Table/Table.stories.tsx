import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Button } from '../Button/Button'
import { EmptyState } from '../EmptyState/EmptyState'
import { Table, type TableColumn } from './Table'

type Row = { id: string; name: string; plan: string; seats: number }

const rows: Row[] = [
  { id: 'a', name: 'Acme', plan: 'Team', seats: 12 },
  { id: 'b', name: 'Globex', plan: 'Free', seats: 3 },
  { id: 'c', name: 'Initech', plan: 'Business', seats: 120 },
]

const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name, rowHeader: true },
  { key: 'plan', header: 'Plan', render: (row) => row.plan },
  { key: 'seats', header: 'Seats', render: (row) => row.seats, align: 'end' },
]

/**
 * 단순 표 — 정렬 · 선택 · 가상 스크롤은 없다. `caption` 이 표 이름이자 스크롤 영역의 이름.
 * 이름 열은 `rowHeader`(행 머리글), 숫자 열은 `align: 'end'`. 빈 목록은 `empty` 에 `<EmptyState />`.
 * 좁은 화면에서는 가로로 스크롤되고 키보드로도 스크롤된다(`tabIndex=0`).
 */
const meta = {
  title: 'UI/Table',
  component: Table<Row>,
  args: { caption: 'Workspaces', columns, rows, rowKey: (row: Row) => row.id },
} satisfies Meta<typeof Table<Row>>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Workspaces' })).toBeVisible()
    await expect(canvas.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Plan',
      'Seats',
    ])
    // 행 머리글과 숫자 열 정렬
    await expect(canvas.getByRole('rowheader', { name: 'Acme' })).toBeVisible()
    await expect(canvas.getAllByRole('row')).toHaveLength(4)
    await expect(canvas.getByRole('cell', { name: '120' })).toHaveAttribute('data-align', 'end')
  },
}

export const Empty: Story = {
  args: {
    rows: [],
    empty: (
      <EmptyState
        title="No workspaces yet"
        description="Create one to get started"
        action={<Button>Create workspace</Button>}
      />
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'No workspaces yet' })).toBeVisible()
    const cell = canvas.getByRole('heading', { name: 'No workspaces yet' }).closest('td')
    await expect(cell).toHaveAttribute('colspan', '3')
  },
}

export const WithActions: Story = {
  args: {
    columns: [
      ...columns,
      {
        key: 'actions',
        header: 'Actions',
        render: (row: Row) => <Button size="sm" variant="ghost">{`Open ${row.name}`}</Button>,
      },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open Globex' }))
    await expect(canvas.getAllByRole('button')).toHaveLength(3)
  },
}

export const KeyboardScrollRegion: Story = {
  play: async ({ canvas, userEvent }) => {
    const region = canvas.getByRole('region', { name: 'Workspaces' })
    await userEvent.tab()
    await expect(region).toHaveFocus()
    await expect(getComputedStyle(region).outlineStyle).toBe('solid')
  },
}

export const LongTextScrollsInsteadOfBreakingTheLayout: Story = {
  args: {
    rows: [
      {
        id: 'x',
        name: 'A workspace whose name is extraordinarily long and refuses to wrap at all'.replaceAll(
          ' ',
          ' ',
        ),
        plan: 'Enterprise',
        seats: 1,
      },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: '20rem' }}>
      <Table {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: 'Workspaces' })
    await expect(region.scrollWidth).toBeGreaterThan(region.clientWidth)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}
