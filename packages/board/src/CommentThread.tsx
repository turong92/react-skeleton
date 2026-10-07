import { useMemo, useState } from 'react'
import { collidingNames } from './authorDisplay'
import { useAuthorScope } from './authorScopeContext'
import { defaultCommentLabels } from './commentLabels'
import type { CommentOptions } from './commentThreadContext'
import { nestThread } from './commentTree'
import { CommentItem, type ThreadContext } from './CommentItem'
import type { BoardId, CommentWithReplies } from './types'

export type CommentThreadProps = CommentOptions & {
  /** 서버가 준 최상위 댓글 + 모든 자손(평평하게) — 트리는 여기서 만든다 */
  thread: CommentWithReplies
  /** 이 영역(한 쪽의 모든 줄기)에서 겹치는 닉네임 키(`collidingNames`) — `BoardComments` 가 쪽 전체로 계산해 넘긴다. 줄기 하나만 그릴 때는 생략 */
  scopeNames?: ReadonlySet<string>
}

/**
 * 댓글 한 줄기 — 중첩 답글 · 답글 칸 · 내 댓글 수정/삭제 · 운영자 숨김 · 반응 · 깊은 답글 접기.
 * 열린 답글 칸 · 접힘 상태는 여기서 쥔다. 데이터 · 호출은 모른다 — 콜백(`onReply` …)을 주면 그 단추가 생긴다.
 */
export function CommentThread({ thread, scopeNames, ...options }: CommentThreadProps) {
  const tree = useMemo(() => nestThread(thread), [thread])
  const own = useMemo(() => collidingNames([thread, ...thread.replies]), [thread])
  const scoped = useAuthorScope(`thread-${thread.id}`, [thread, ...thread.replies])
  const colliding = useMemo(
    () =>
      scoped || scopeNames ? new Set([...own, ...(scoped ?? []), ...(scopeNames ?? [])]) : own,
    [own, scoped, scopeNames],
  )
  const [replyingTo, setReplyingTo] = useState<BoardId | null>(null)
  const [editing, setEditing] = useState<BoardId | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<BoardId>>(new Set())

  const ctx: ThreadContext = {
    ...options,
    labels: { ...defaultCommentLabels, ...options.labels },
    collapseFromDepth: options.collapseFromDepth ?? 2,
    collidingNames: colliding,
    replyingTo,
    editing,
    expanded,
    setReplyingTo: (id) => {
      setReplyingTo(id)
      setEditing(null)
    },
    setEditing: (id) => {
      setEditing(id)
      setReplyingTo(null)
    },
    expand: (id) => setExpanded((current) => new Set(current).add(id)),
    toggleExpanded: (id) =>
      setExpanded((current) => {
        const next = new Set(current)
        if (!next.delete(id)) next.add(id)
        return next
      }),
  }
  return <CommentItem node={tree} ctx={ctx} />
}
