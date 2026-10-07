import type { ReactNode } from 'react'
import type { AuthorInfo, AuthorTagMode } from './authorDisplay'
import type { CommentLabels } from './commentLabels'
import type { AuthorPicker } from './authorship'
import type { BoardId, CommentStatus, ReactionType } from './types'

/** 댓글 영역이 서버와 이어질 때 모두가 같이 쓰는 설정 · 콜백(`CommentThread` · `BoardComments` 의 props 공통부) */
export type CommentOptions = {
  /** 내 계정 id — `mine` 이 없는 옛 서버 응답에서만 소유 판정에 쓴다(서버가 `mine` 을 주면 그것이 정본) */
  currentUserId?: string
  /** 운영자(`BoardConfig.canModerate`) — 숨김 · 복구 단추와 남의 댓글 삭제 */
  canModerate?: boolean
  /** 댓글 깊이의 최대값(`BoardConfig.maxCommentDepth`) — 이 깊이의 댓글에는 답글 단추가 없다 */
  maxDepth: number
  /** 댓글 길이 한도(`BoardConfig.commentMaxLength`) */
  commentMaxLength: number
  /** 이 깊이 이상의 답글은 「답글 N개 더 보기」 뒤에 접는다(기본 2). 접지 않으려면 큰 수 */
  collapseFromDepth?: number
  /** 그릴 반응 종류(`BoardConfig.reactionTypes`) — 비면 반응 줄이 없다 */
  reactionTypes?: readonly ReactionType[]
  reactionLabels?: Partial<Record<ReactionType, string>>
  reactionIcons?: Partial<Record<ReactionType, ReactNode>>
  /** 시각 글자(기본 `@skeleton/time` 의 `formatInstant`) */
  formatTime?: (iso: string) => string
  /** 작성자 표시(기본 아바타 + 닉네임). 두 번째 인자로 화면에 보일 이름 · 종류가 온다 — `(authorId) => …` 꼴의 옛 호출부도 그대로 동작한다 */
  renderAuthor?: (authorId: string, author: AuthorInfo) => ReactNode
  /** 작성자 꼬리표를 보일 때 — 기본은 이 스레드에서 닉네임이 겹칠 때만 */
  authorTag?: AuthorTagMode
  labels?: Partial<CommentLabels>
  /** 작성자 선택기 자리 — 답글 칸의 제출 단추 옆에 그려진다. 고른 id 는 `onReply` 의 셋째 인자 */
  authorPicker?: AuthorPicker
  /** 작성자를 골라야 보낼 수 있다(`BoardConfig.authorRequired`) */
  authorRequired?: boolean
  /** 이 스레드에서 내가 마지막으로 쓴 작성자 id(`lastOwnAuthorId`) — 생략하면 이 줄기에서 찾는다 */
  threadAuthorId?: string
  /** 댓글을 아직 불러오는 중 — 선택기가 처음 값을 확정하지 않고 기다린다 */
  threadLoading?: boolean
  /** 콜백을 주어야 그 단추가 생긴다. 약속을 돌려주면 끝날 때까지 폼이 「보내는 중」 */
  onReply?: (parentId: BoardId, body: string, authorId?: string) => Promise<unknown> | void
  onEdit?: (id: BoardId, body: string) => Promise<unknown> | void
  onDelete?: (id: BoardId) => void
  onModerate?: (id: BoardId, status: CommentStatus) => void
  /** `active` 는 누른 뒤의 상태 */
  onReact?: (id: BoardId, type: ReactionType, active: boolean) => void
}
