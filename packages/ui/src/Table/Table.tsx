import type { ReactNode } from 'react'
import styles from './Table.module.css'

export type TableColumn<Row> = {
  key: string
  header: ReactNode
  render: (row: Row) => ReactNode
  /** 숫자 열은 `end` */
  align?: 'start' | 'center' | 'end'
  /** true 면 이 열의 셀이 그 행의 머리글(`<th scope="row">`) */
  rowHeader?: boolean
}

export type TableProps<Row> = {
  /** 표 이름 — `<caption>` 이자 스크롤 영역의 이름 */
  caption: string
  columns: TableColumn<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  /** 행이 없을 때 모든 열에 걸쳐 보이는 내용(예: `<EmptyState />`) */
  empty?: ReactNode
}

/** 단순 표 — 정렬 · 선택 · 가상 스크롤은 없다. 좁은 화면에서는 가로로 스크롤되고, 키보드로도 스크롤할 수 있다 */
export function Table<Row>({ caption, columns, rows, rowKey, empty }: TableProps<Row>) {
  return (
    <div role="region" tabIndex={0} aria-label={caption} className={styles.scroll}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty !== undefined ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th key={column.key} scope="row" data-align={column.align}>
                      {column.render(row)}
                    </th>
                  ) : (
                    <td key={column.key} data-align={column.align}>
                      {column.render(row)}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
