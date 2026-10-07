import type { ReactNode } from 'react'
import type { Comment, CommentWithReplies } from './types'

/**
 * 「내 것인가」 — 서버가 응답에 싣는 `mine` 이 정본이다. 작성자 id 가 계정과 다른 서버(작성자 프로필)에서는
 * `authorId === currentUserId` 가 늘 거짓이라, `mine` 이 없는 옛 서버일 때만 id 를 비교한다.
 */
export function isOwn(
  item: { mine?: boolean; authorId: string },
  currentUserId: string | undefined,
): boolean {
  return item.mine ?? (currentUserId !== undefined && item.authorId === currentUserId)
}

/** 읽을 수 없는 시각은 가장 이른 것으로(비교가 NaN 으로 어긋나지 않게) */
const instant = (iso: string) => {
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

type Walkable = Comment & { replies?: readonly Walkable[] }

/** 켜기 전에 쌓인 옛 행의 공개 id(`pending:p<id>` · `pending:c<id>`) — 어느 프로필의 것도 아니라 선택기의 단서가 못 된다 */
const PENDING_ID_PREFIX = 'pending:'

/** 선택기가 처음 값으로 삼을 수 있는 내 작성자 id 인가 — `mine` 이고, 탈퇴 표시가 아니고, 옛 행의 `pending:` 가 아닐 때 */
export function isUsableOwnAuthorId(item: {
  mine?: boolean
  authorId: string
  authorDeleted?: boolean
}): boolean {
  return (
    item.mine === true &&
    item.authorDeleted !== true &&
    !item.authorId.startsWith(PENDING_ID_PREFIX)
  )
}

/**
 * 이 스레드에서 내가 **마지막으로** 쓴 댓글의 `authorId`(없으면 undefined). `mine` 이 참인 댓글만 센다 —
 * `mine` 이 없는 옛 서버 응답은 판정하지 않고, 탈퇴한 작성자(`authorDeleted`)와 옛 행의 `pending:` id 는 건너뛴다.
 * 서버는 최상위 아래에 모든 자손을 평평하게 주지만(`replies`), 중첩돼 와도 따라 내려간다.
 * 시각은 `Date.parse` 로 비교한다(오프셋이 다른 ISO 문자열의 사전순이 아니다). 같은 시각이면 id 가 큰 쪽.
 */
export function lastOwnAuthorId(
  comments: readonly (Comment | CommentWithReplies)[],
): string | undefined {
  let best: Comment | undefined
  const visit = (items: readonly Walkable[]) => {
    for (const item of items) {
      if (isUsableOwnAuthorId(item)) {
        const at = instant(item.createdAt)
        const bestAt = best ? instant(best.createdAt) : Number.NEGATIVE_INFINITY
        if (!best || at > bestAt || (at === bestAt && item.id > best.id)) best = item
      }
      if (item.replies) visit(item.replies)
    }
  }
  visit(comments)
  return best?.authorId
}

/**
 * 이 글의 댓글을 **아직** 모르는가 — 현재 쪽의 댓글이 오는 중이거나(첫 불러오기), 쪽 · 정렬을 바꾸는 사이 이전 쪽 데이터가 자리를 지키는 중(`isPlaceholderData`)이면 true.
 * 이때 선택기는 처음 값을 확정하지 않고 잠긴다. **첫 불러오기가 실패해 데이터가 없는 것은 「모름」이 아니라 「실패」**라 false 다 —
 * 선택기는 잠기지 않고(수동 선택 · 기기 기억으로 채움 가능, 스레드를 모르니 「이 스레드에서 쓴 프로필」 확인은 없다), 댓글 영역의 「다시 시도」가 목록을 다시 받는다.
 */
export function threadIsUnknown(query: {
  data: unknown
  isPlaceholderData: boolean
  isError: boolean
}): boolean {
  return query.isPlaceholderData || (query.data === undefined && !query.isError)
}

/** `authorPicker` 렌더 함수가 받는 것 — 보드는 선택기가 무엇인지 모른다(작성자 프로필이든 무엇이든 값은 문자열 id 하나) */
export type AuthorPickerArgs = {
  /** 지금 고른 작성자 id — 없으면 undefined(골라야 보낼 수 있다) */
  value: string | undefined
  /** 바꾼다. 처음 값을 정하는 것도 선택기의 몫이다(effect 에서 불러도 된다) */
  onChange: (authorId: string | undefined) => void
  /**
   * 이 스레드(글의 댓글)에서 내가 마지막으로 쓴 작성자 id — 현재 불러온 쪽의 댓글 기준이다(다른 쪽에 쓴 것은 모른다).
   * undefined 는 「쓴 적 없음」이거나 「아직 모름」(`threadLoading`). 글쓰기 폼에는 늘 undefined
   */
  threadAuthorId: string | undefined
  /** 댓글을 아직 불러오는 중 — true 인 동안 `threadAuthorId` 가 undefined 인 것은 「쓴 적 없음」이 아니다. 처음 값을 확정하지 말고(기기 기억으로도 넘어가지 말고) 기다린다 */
  threadLoading: boolean
  /** 칸 오류 문장의 id — 오류가 보일 때만 있다. 선택기의 조작 요소에 `aria-describedby` 로 잇는다 */
  'aria-describedby'?: string
  /** 칸 오류 문장이 보이는 중인가 — 선택기가 `aria-invalid` 를 걸 수 있게 */
  invalid: boolean
  /** 보내는 중 */
  disabled: boolean
  /**
   * 선택기가 **답이 필요한 질문**(예: 「이 스레드에서는 ○○로 썼어요」 한 줄 확인)을 띄웠다/풀었다를 폼에 알린다. true 인 동안 폼은 제출을 막고
   * (확정되지 않은 값으로 글이 나가지 않게) 포커스를 질문으로 보낸다 — 질문 요소에 `data-author-notice` 를 달면 거기로, 없으면 선택기의 첫 조작 요소로. 폼은 안정된 함수를 준다
   */
  onUnsettledChange: (unsettled: boolean) => void
}
export type AuthorPicker = (args: AuthorPickerArgs) => ReactNode
