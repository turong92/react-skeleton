import { formatCount } from './format'
import type { DashboardLabels } from './labels'
import type { DashboardRanking } from './types'
import styles from './RankingTable.module.css'

export type RankingTableProps = {
  ranking: DashboardRanking
  locale?: string
  labels: Pick<DashboardLabels, 'columns' | 'rankings'>
}

/** 순위 표 - 첫 열은 이름(순번 · 첫 숫자 열에 비례하는 가는 막대), 나머지는 숫자 열. 이름이 길면 줄여 보이고 전체는 `title` 로 */
export function RankingTable({ ranking, locale, labels }: RankingTableProps) {
  const [labelColumn, ...valueColumns] = ranking.columns
  const max = Math.max(1, ...ranking.rows.map((row) => row.values[0] ?? 0))
  const header = (column: string) => labels.columns[column] ?? column
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>{labels.rankings[ranking.key] ?? ranking.label}</caption>
      <thead>
        <tr>
          <th scope="col">{header(labelColumn ?? '')}</th>
          {valueColumns.map((column) => (
            <th key={column} scope="col" data-end="true">
              {header(column)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ranking.rows.map((row, index) => (
          <tr key={`${index}:${row.label}`}>
            <th scope="row" className={styles.label}>
              <div className={styles.cell}>
                <span className={styles.rank} aria-hidden="true">
                  {index + 1}
                </span>
                <div className={styles.text}>
                  <span className={styles.name} title={row.label}>
                    {row.label}
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <i style={{ width: `${((row.values[0] ?? 0) / max) * 100}%` }} />
                  </span>
                </div>
              </div>
            </th>
            {valueColumns.map((column, i) => (
              <td key={column} data-end="true">
                {formatCount(row.values[i] ?? 0, locale)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
