import { Alert, Badge, Button, EmptyState, Pagination, Skeleton } from '@skeleton/ui'
import { useState, type ReactNode } from 'react'
import { Highlight } from './Highlight'
import { defaultSearchLabels, type SearchLabels } from './labels'
import { useSearch } from './queries'
import type { SearchApi } from './searchApi'
import styles from './SearchResults.module.css'
import type { SearchTypeInfo } from './types'

/** 서버가 세기를 멈추는 결과 창 상한(1,000번째) */
const WINDOW_CAP = 1000

export type SearchResultsProps = {
  api: Pick<SearchApi, 'search'>
  /** 찾는 글자 - 보통 주소의 `?q=` */
  query: string
  /** 종류마다 이름과 링크 - 패키지는 어떤 종류가 있는지 모른다 */
  describe: (type: string) => SearchTypeInfo
  /** 거르기 칩으로 내놓을 종류들(둘 이상일 때만 그린다). 아무것도 안 누르면 모든 종류 */
  types?: string[]
  labels?: SearchLabels
  /** 한 쪽의 개수(기본 10, 서버 상한 50) */
  pageSize?: number
  /** 링크를 앱의 라우터 링크로 그린다(기본은 일반 `<a>`) */
  renderLink?: (href: string, children: ReactNode) => ReactNode
}

const plainLink = (href: string, children: ReactNode) => <a href={href}>{children}</a>

/** 검색 결과 - 종류 칩 · 개수 · 제목 링크 + 발췌(일치한 곳은 `<mark>`) · 쪽 이동 · 빈 / 로딩 / 오류 · 「2글자 이상」 안내 */
export function SearchResults({
  api,
  query,
  describe,
  types = [],
  labels = defaultSearchLabels,
  pageSize = 10,
  renderLink = plainLink,
}: SearchResultsProps) {
  const t = labels.results
  const q = query.trim()
  // 조건(찾는 글자 · 종류)이 바뀌면 첫 쪽으로 - 찾는 글자가 바뀐 것은 그릴 때 알아차린다
  const [state, setState] = useState({ q, picked: [] as string[], page: 0 })
  let view = state
  if (state.q !== q) {
    view = { q, picked: state.picked, page: 0 }
    setState(view)
  }
  const { picked, page } = view

  const {
    query: result,
    searchable,
    settling,
  } = useSearch(api, {
    q,
    types: picked,
    page,
    size: pageSize,
  })

  const chip = (pressed: boolean, label: string, onClick: () => void) => (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={pressed}
      className={styles.chip}
      onClick={onClick}
    >
      {pressed ? '✓ ' : ''}
      {label}
    </Button>
  )
  const pick = (next: string[]) => setState({ ...view, picked: next, page: 0 })
  const toggle = (type: string) =>
    pick(picked.includes(type) ? picked.filter((value) => value !== type) : [...picked, type])

  const chips = types.length > 1 && (
    <div className={styles.chips} role="group" aria-label={t.typeFilter}>
      {chip(picked.length === 0, t.allTypes, () => pick([]))}
      {types.map((type) => (
        <span key={type}>
          {chip(picked.includes(type), describe(type).label, () => toggle(type))}
        </span>
      ))}
    </div>
  )

  let body: ReactNode
  if (!searchable) {
    body = <Alert tone="info">{t.tooShort}</Alert>
  } else if (result.isPending) {
    body = <Skeleton lines={4} label={t.loading} />
  } else if (result.isError) {
    body = (
      <Alert
        tone="danger"
        action={
          <Button variant="secondary" size="sm" onClick={() => void result.refetch()}>
            {t.retry}
          </Button>
        }
      >
        {t.loadFailed}
      </Alert>
    )
  } else if (result.data.values.length === 0) {
    body = <EmptyState title={t.emptyTitle(q)} description={t.emptyBody} headingLevel={2} />
  } else {
    const { values, pagination } = result.data
    body = (
      <>
        <p className={styles.count} aria-live="polite">
          {t.count(pagination.totalElements, pagination.totalElements >= WINDOW_CAP)}
        </p>
        <ul
          className={styles.list}
          aria-busy={result.isFetching || settling || undefined}
          data-fetching={result.isFetching || settling}
        >
          {values.map((hit) => {
            const info = describe(hit.type)
            return (
              <li key={`${hit.type}:${hit.id}`} className={styles.row}>
                <Badge>{info.label}</Badge>
                <h2 className={styles.title}>
                  {renderLink(
                    info.href(hit.id),
                    <Highlight text={hit.title} ranges={hit.titleHighlights} />,
                  )}
                </h2>
                {hit.snippet && (
                  <p className={styles.snippet}>
                    <Highlight text={hit.snippet} ranges={hit.snippetHighlights} />
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(next) => setState({ ...view, page: next })}
          label={t.pagination}
          previousLabel={t.previous}
          nextLabel={t.next}
          pageLabel={t.page}
        />
      </>
    )
  }

  return (
    <div className={styles.root}>
      {chips}
      {body}
    </div>
  )
}
