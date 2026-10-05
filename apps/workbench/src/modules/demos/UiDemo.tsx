import {
  Button,
  Checkbox,
  EmptyState,
  Field,
  Pagination,
  Switch,
  Table,
  Tabs,
  Textarea,
  toastPromise,
} from '@skeleton/ui'
import { useState } from 'react'
import styles from './Demo.module.css'

type Row = { id: string; name: string; qty: number }
const ROWS: Row[] = [
  { id: 'a', name: 'Apple', qty: 3 },
  { id: 'b', name: 'Pear', qty: 12 },
]

/** `@skeleton/ui` 의 새 부품 — 키보드로도 눌러 본다(Tab · Space · 화살표) */
export function UiDemo() {
  const [page, setPage] = useState(0)
  return (
    <div className={styles.stack}>
      <Field label="메모" hint="Textarea">
        {(c) => <Textarea {...c} />}
      </Field>
      <Checkbox label="약관에 동의합니다" description="Checkbox" />
      <Switch label="이메일 알림" description="Switch (role=switch)" />
      <Tabs
        aria-label="예시 탭"
        items={[
          { id: 'a', label: '첫째', content: <p>← → Home End 로 옮긴다</p> },
          { id: 'b', label: '둘째', content: <p>둘째 패널</p> },
          { id: 'c', label: '셋째(꺼짐)', content: <p>-</p>, disabled: true },
        ]}
      />
      <Table
        caption="과일"
        columns={[
          { key: 'name', header: '이름', rowHeader: true, render: (r: Row) => r.name },
          { key: 'qty', header: '수량', align: 'end', render: (r: Row) => r.qty },
        ]}
        rows={ROWS}
        rowKey={(r) => r.id}
      />
      <Pagination page={page} totalPages={12} onPageChange={setPage} />
      <EmptyState title="비어 있음" description="EmptyState" />
      <div className={styles.row}>
        <Button
          variant="secondary"
          onClick={() =>
            void toastPromise(
              new Promise<string>((resolve) => setTimeout(() => resolve('끝'), 800)),
              {
                loading: '처리 중…',
                success: (v) => `완료: ${v}`,
              },
            )
          }
        >
          toastPromise
        </Button>
      </div>
    </div>
  )
}
