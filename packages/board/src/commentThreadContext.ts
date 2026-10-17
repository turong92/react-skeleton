import type { ReactNode } from 'react'
import type { AuthorInfo, AuthorTagMode } from './authorDisplay'
import type { CommentLabels } from './commentLabels'
import type { AuthorPicker } from './authorship'
import type { AttachmentPicker, CommentSubmitExtra } from './commentExtras'
import type { GuestUi } from './guestUi'
import type { BoardId, Comment, CommentStatus, ReactionType, RevisionDecision } from './types'

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
  /** 로그인하지 않고 쓰는 화면이면 — 새 댓글 · 답글 폼에 이름 · 비밀번호(· 캡차) 칸이 생기고 비회원 자기 댓글의 고치기가 비밀번호를 묻는다 */
  guest?: GuestUi
  /** 호출자가 이 글의 댓글을 승인 · 가릴 수 있다(`PostDetail.canManageComments`) — 승인 · 가리기 단추. 운영자(`canModerate`)는 따로 삭제도 한다 */
  canManageComments?: boolean
  /** 이 브라우저가 비회원으로 쓴 댓글 id들 — 서버는 비회원을 모르므로(`mine` 은 늘 false) 화면이 자기가 가진 것으로 고치기 · 지우기를 보인다 */
  ownGuestIds?: ReadonlySet<BoardId>
  /** 댓글 첨부(저장 키)를 그리는 법 — 앱의 키 → 주소 규칙. 없으면 키 글자만 */
  renderAttachment?: (key: string, comment: Comment) => ReactNode
  /** 첨부 고르는 자리와 상한(`BoardConfig.commentMaxAttachments`) — 업로드는 앱 몫 */
  attachmentPicker?: AttachmentPicker
  maxAttachments?: number
  /** 콜백을 주어야 그 단추가 생긴다. 약속을 돌려주면 끝날 때까지 폼이 「보내는 중」 */
  onReply?: (
    parentId: BoardId,
    body: string,
    authorId?: string,
    extra?: CommentSubmitExtra,
  ) => Promise<unknown> | void
  onEdit?: (id: BoardId, body: string, extra?: CommentSubmitExtra) => Promise<unknown> | void
  /** 고친 댓글 승인 · 거절(관리하는 쪽) */
  onDecideRevision?: (id: BoardId, decision: RevisionDecision, submittedAt: string) => void
  onDelete?: (id: BoardId) => void
  onModerate?: (id: BoardId, status: CommentStatus) => void
  /** `active` 는 누른 뒤의 상태 */
  onReact?: (id: BoardId, type: ReactionType, active: boolean) => void
}
