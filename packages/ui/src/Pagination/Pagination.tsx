import { paginationItems } from './paginationItems'
import styles from './Pagination.module.css'

export type PaginationProps = {
  /** 현재 쪽 — 0 부터(백엔드 `PaginationMeta.page`) */
  page: number
  /** 전체 쪽 수(`PaginationMeta.totalPages`). 1 이하면 아무것도 그리지 않는다 */
  totalPages: number
  /** 누른 쪽의 0 기반 번호 */
  onPageChange: (page: number) => void
  /** 현재 쪽 양옆에 보일 쪽 수(기본 1) */
  siblings?: number
  /** `<nav>` 이름(기본 `Pagination`) */
  label?: string
  previousLabel?: string
  nextLabel?: string
  /** 쪽 버튼의 낭독 이름. n 은 1 부터(기본 `Page n`) */
  pageLabel?: (page: number) => string
}

/** 쪽 이동 — 보이는 번호는 1 부터, `onPageChange` 는 0 기반. 현재 쪽은 `aria-current="page"` */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblings = 1,
  label = 'Pagination',
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  pageLabel = (n) => `Page ${n}`,
}: PaginationProps) {
  if (totalPages <= 1) return null
  const last = totalPages - 1
  return (
    <nav aria-label={label} className={styles.nav}>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={styles.button}
            aria-label={previousLabel}
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
          >
            ‹
          </button>
        </li>
        {paginationItems(page, totalPages, siblings).map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden="true" className={styles.gap}>
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={styles.button}
                aria-label={pageLabel(item + 1)}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {item + 1}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className={styles.button}
            aria-label={nextLabel}
            disabled={page >= last}
            onClick={() => onPageChange(page + 1)}
          >
            ›
          </button>
        </li>
      </ul>
    </nav>
  )
}
