import { Inbox } from 'lucide-react'
import { Button, Card, EmptyState, Pagination, Table, Tabs } from '@skeleton/ui'
import { Case } from '../../components/Section'
import { PaginationDemo } from './PaginationDemo'
import type { UiEntry } from '../types'

type Person = { name: string; role: string; score: number }
const PEOPLE: Person[] = [
  { name: 'Ada', role: 'Engineer', score: 98 },
  { name: 'Grace', role: 'Admiral', score: 87 },
]
const COLUMNS = [
  { key: 'name', header: '이름', render: (row: Person) => row.name, rowHeader: true },
  { key: 'role', header: '역할', render: (row: Person) => row.role },
  { key: 'score', header: '점수', render: (row: Person) => row.score, align: 'end' as const },
]

export const dataEntries: UiEntry[] = [
  {
    name: 'Table',
    title: '표 — 행 머리글 · 숫자 열 · 빈 상태',
    render: () => (
      <>
        <Case label="rows">
          <Table caption="사람" columns={COLUMNS} rows={PEOPLE} rowKey={(row) => row.name} />
        </Case>
        <Case label="empty">
          <Table
            caption="비어 있음"
            columns={COLUMNS}
            rows={[]}
            rowKey={(row: Person) => row.name}
            empty={<EmptyState title="사람이 없습니다" />}
          />
        </Case>
      </>
    ),
  },
  {
    name: 'Pagination',
    title: '쪽 이동 — 처음 · 가운데 · 끝 · 눌러 보기',
    render: () => (
      <>
        <Case label="first page">
          <Pagination page={0} totalPages={12} onPageChange={() => undefined} />
        </Case>
        <Case label="last page">
          <Pagination page={11} totalPages={12} onPageChange={() => undefined} />
        </Case>
        <PaginationDemo />
      </>
    ),
  },
  {
    name: 'Tabs',
    title: '탭 — 가로 · 세로 · 비활성 탭(화살표 · Home · End)',
    render: () => {
      const items = [
        { id: 'a', label: '개요', content: <p>개요 패널</p> },
        { id: 'b', label: '설정', content: <p>설정 패널</p> },
        { id: 'c', label: '비활성', content: <p>안 보임</p>, disabled: true },
      ]
      return (
        <>
          <Case label="horizontal">
            <Tabs items={items} aria-label="가로 탭" />
          </Case>
          <Case label="vertical">
            <Tabs items={items} orientation="vertical" aria-label="세로 탭" />
          </Case>
        </>
      )
    },
  },
  {
    name: 'EmptyState',
    title: '빈 상태 — 제목만 · 아이콘과 행동',
    render: () => (
      <>
        <Case label="title only">
          <EmptyState title="결과가 없습니다" />
        </Case>
        <Case label="icon + description + action">
          <EmptyState
            title="받은 알림이 없습니다"
            description="새 소식이 오면 여기에 보입니다."
            icon={<Inbox size={32} />}
            action={<Button variant="secondary">새로 고침</Button>}
          />
        </Case>
      </>
    ),
  },
  {
    name: 'Card',
    title: '카드 — 제목 · 행동 · 제목 없음',
    render: () => (
      <>
        <Case label="title + actions">
          <Card title="카드 제목" actions={<Button size="sm">행동</Button>}>
            <p>본문</p>
          </Card>
        </Case>
        <Case label="no title">
          <Card>
            <p>제목 없는 카드</p>
          </Card>
        </Case>
      </>
    ),
  },
]
