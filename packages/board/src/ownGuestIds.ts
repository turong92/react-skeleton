import { useCallback, useMemo, useState } from 'react'
import type { BoardId } from './types'

/*
 * 서버는 비회원을 모른다(`mine` 은 늘 false) — 이 브라우저가 비회원으로 쓴 글 · 댓글의 id 만 기억해 두었다가 고치기 · 지우기를 보인다.
 * 비밀은 기억하지 않는다(고칠 때마다 다시 묻는다). 저장소가 막혀 있으면(사생활 보호 창 등) 이 탭 동안만 기억한다.
 */
function read(storageKey: string): BoardId[] {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : []
  } catch {
    return []
  }
}

function write(storageKey: string, ids: BoardId[]) {
  try {
    globalThis.localStorage?.setItem(storageKey, JSON.stringify(ids.slice(-200)))
  } catch {
    // 저장소를 쓸 수 없다 — 이 탭의 상태로만 남는다
  }
}

/** 이 브라우저가 비회원으로 쓴 id들 — 키는 앱이 정한다(예: 게시판 코드별 `board:free:guest-comments`) */
export function useOwnGuestIds(storageKey: string) {
  const [list, setList] = useState<BoardId[]>(() => read(storageKey))
  const ids = useMemo<ReadonlySet<BoardId>>(() => new Set(list), [list])
  const add = useCallback(
    (id: BoardId) =>
      setList((current) => {
        if (current.includes(id)) return current
        const next = [...current, id]
        write(storageKey, next)
        return next
      }),
    [storageKey],
  )
  const remove = useCallback(
    (id: BoardId) =>
      setList((current) => {
        const next = current.filter((value) => value !== id)
        write(storageKey, next)
        return next
      }),
    [storageKey],
  )
  return { ids, add, remove }
}
