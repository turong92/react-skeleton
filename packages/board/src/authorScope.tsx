import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { collidingNames, type AuthorFields } from './authorDisplay'
import { AuthorScopeContext } from './authorScopeContext'

/**
 * 꼬리표 겹침을 한 범위로 묶는다 — 글 상세 화면에서 `PostDetail` · `BoardComments`(또는 `CommentThread`)를 감싸면
 * 글쓴이와 그 글의 모든 댓글 작성자가 함께 판정된다(글쓴이와 댓글 작성자가 다른 계정인데 닉네임이 같으면 양쪽에 꼬리표).
 * 감싸지 않으면 목록 · 스레드 각각 따로 판정한다(기본).
 */
export function AuthorScope({ children }: { children: ReactNode }) {
  const [reported, setReported] = useState<ReadonlyMap<string, readonly AuthorFields[]>>(new Map())
  const report = useCallback((key: string, authors: readonly AuthorFields[]) => {
    setReported((current) => new Map(current).set(key, authors))
  }, [])
  const forget = useCallback((key: string) => {
    setReported((current) => {
      if (!current.has(key)) return current
      const next = new Map(current)
      next.delete(key)
      return next
    })
  }, [])
  const names = useMemo(() => collidingNames([...reported.values()].flat()), [reported])
  const value = useMemo(() => ({ report, forget, names }), [report, forget, names])
  return <AuthorScopeContext.Provider value={value}>{children}</AuthorScopeContext.Provider>
}
