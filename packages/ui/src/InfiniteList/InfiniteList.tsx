import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert } from '../Alert/Alert'
import { Button } from '../Button/Button'
import styles from './InfiniteList.module.css'
import { shouldLoadMore } from './shouldLoadMore'

export type InfiniteListProps<T> = {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T, index: number) => ReactNode
  hasMore: boolean
  loading?: boolean
  /** 직전 쪽이 실패했다 — 자동 불러오기가 멈추고 다시 시도 버튼이 나온다 */
  error?: boolean
  /** 끝 표지가 보이면 자동으로 다음 쪽(기본 true). false 면 「더 보기」 버튼만 */
  auto?: boolean
  onLoadMore: () => void
  /** 목록의 이름(권장) */
  label?: string
  /** 항목이 하나도 없을 때(불러오는 중이 아닐 때) */
  empty?: ReactNode
  loadMoreLabel?: string
  loadingLabel?: string
  endLabel?: string
  errorLabel?: string
  retryLabel?: string
  /** 끝에 닿기 이만큼 앞서 미리 부른다(기본 `200px`) */
  rootMargin?: string
}

/**
 * 이어 보기 목록 — 끝 표지가 화면에 들어오면 자동으로 다음 쪽(`IntersectionObserver`), **그리고 언제나** 키보드로 누를 수 있는 「더 보기」 버튼.
 * 자동 불러오기는 편의일 뿐이라 관찰자가 없는 환경 · 움직임 줄이기 · 키보드 사용자도 같은 일을 한다. 실패하면 멈추고 다시 시도 버튼.
 * 끝에 닿아 버튼이 사라질 때 포커스가 있었다면 끝 안내로 옮긴다(포커스가 문서 맨 위로 날아가지 않게).
 */
export function InfiniteList<T>({
  items,
  getKey,
  renderItem,
  hasMore,
  loading = false,
  error = false,
  auto = true,
  onLoadMore,
  label,
  empty,
  loadMoreLabel = 'Load more',
  loadingLabel = 'Loading',
  endLabel,
  errorLabel = 'Could not load more',
  retryLabel = 'Try again',
  rootMargin = '200px',
}: InfiniteListProps<T>) {
  const sentinel = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLParagraphElement>(null)
  const loadRef = useRef(onLoadMore)
  const buttonFocused = useRef(false)
  const [intersecting, setIntersecting] = useState(false)

  useEffect(() => {
    loadRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    const node = sentinel.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setIntersecting(entries.some((entry) => entry.isIntersecting)),
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin])

  // 쪽이 붙은 뒤에도 끝 표지가 여전히 보이면(화면이 덜 찼다) 관찰자가 다시 알려 주지 않으니 상태 변화로 이어 부른다
  const trigger = auto && shouldLoadMore({ hasMore, loading, error, intersecting })
  useEffect(() => {
    if (trigger) loadRef.current()
  }, [trigger, items.length])

  useEffect(() => {
    if (!hasMore && buttonFocused.current) {
      buttonFocused.current = false
      endRef.current?.focus()
    }
  }, [hasMore])

  return (
    <div className={styles.root} aria-busy={loading || undefined}>
      {items.length === 0 && !loading && !hasMore ? (
        empty
      ) : (
        <ul className={styles.list} aria-label={label}>
          {items.map((item, index) => (
            <li key={getKey(item)} className={styles.item}>
              {renderItem(item, index)}
            </li>
          ))}
        </ul>
      )}
      <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />
      <div role="status" className={loading ? styles.status : styles.srOnly}>
        {loading ? loadingLabel : ''}
      </div>
      {error && hasMore && (
        <Alert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={onLoadMore}>
              {retryLabel}
            </Button>
          }
        >
          {errorLabel}
        </Alert>
      )}
      {hasMore && !error && (
        <div className={styles.more}>
          {/* 일하는 중에도 잠그지 않는다(잠그면 키보드 포커스가 버튼에서 떨어진다) — 눌러도 무시하고 낭독은 위의 status 가 맡는다 */}
          <Button
            variant="secondary"
            aria-busy={loading || undefined}
            onClick={() => {
              if (!loading) onLoadMore()
            }}
            onFocus={() => (buttonFocused.current = true)}
            onBlur={() => (buttonFocused.current = false)}
          >
            {loadMoreLabel}
          </Button>
        </div>
      )}
      {!hasMore && items.length > 0 && endLabel && (
        <p ref={endRef} tabIndex={-1} className={styles.end}>
          {endLabel}
        </p>
      )}
    </div>
  )
}
