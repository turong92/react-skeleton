import { createContext, useContext, useEffect } from 'react'
import type { AuthorFields } from './authorDisplay'

export type AuthorScopeValue = {
  report: (key: string, authors: readonly AuthorFields[]) => void
  forget: (key: string) => void
  /** 이 범위 전체에서 서로 다른 계정이 같이 쓰는 닉네임 */
  names: ReadonlySet<string>
}

export const AuthorScopeContext = createContext<AuthorScopeValue | null>(null)

const signature = (authors: readonly AuthorFields[]) =>
  authors
    .map((a) => `${a.authorId}\u0000${a.authorName ?? ''}\u0000${a.authorDeleted ?? ''}`)
    .join('\u0001')

/** 범위가 있으면 이 자리의 작성자들을 알리고, 범위 전체의 겹치는 닉네임을 돌려준다(범위가 없으면 undefined) */
export function useAuthorScope(key: string, authors: readonly AuthorFields[]) {
  const scope = useContext(AuthorScopeContext)
  const sig = signature(authors)
  const report = scope?.report
  const forget = scope?.forget
  useEffect(() => {
    report?.(key, authors)
    return () => forget?.(key)
    // authors 의 내용(sig)이 바뀔 때만 다시 알린다
  }, [report, forget, key, sig]) // eslint-disable-line react-hooks/exhaustive-deps
  return scope?.names
}
