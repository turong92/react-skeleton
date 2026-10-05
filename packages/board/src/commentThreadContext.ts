import type { ReactNode } from 'react'
import type { CommentLabels } from './commentLabels'
import type { BoardId, CommentStatus, ReactionType } from './types'

/** 댓글 영역이 서버와 이어질 때 모두가 같이 쓰는 설정 · 콜백(`CommentThread` · `BoardComments` 의 props 공통부) */
export type CommentOptions = {
  /** 내 계정 id — 내 댓글에만 수정 · 삭제가 생긴다 */
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
  /** 작성자 표시(기본 계정 id 그대로) — 서버 계약에는 이름이 없으니 앱이 id → 이름을 안다면 여기서 */
  renderAuthor?: (authorId: string) => ReactNode
  labels?: Partial<CommentLabels>
  /** 콜백을 주어야 그 단추가 생긴다. 약속을 돌려주면 끝날 때까지 폼이 「보내는 중」 */
  onReply?: (parentId: BoardId, body: string) => Promise<unknown> | void
  onEdit?: (id: BoardId, body: string) => Promise<unknown> | void
  onDelete?: (id: BoardId) => void
  onModerate?: (id: BoardId, status: CommentStatus) => void
  /** `active` 는 누른 뒤의 상태 */
  onReact?: (id: BoardId, type: ReactionType, active: boolean) => void
}
