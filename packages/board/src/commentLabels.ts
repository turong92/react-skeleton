import { defaultAuthorLabels, type AuthorLabels } from './authorDisplay'
import {
  defaultGuestLabels,
  defaultRevisionLabels,
  type GuestLabels,
  type RevisionLabels,
} from './guestLabels'

/** 댓글 영역의 글자 전부 — 기본은 영어. 일부만 덮어쓰려면 `labels={{ reply: '답글' }}` */
export type CommentLabels = AuthorLabels &
  GuestLabels &
  RevisionLabels & {
    reply: string
    edit: string
    delete: string
    hide: string
    restore: string
    save: string
    cancel: string
    /** 새 댓글 칸의 라벨 · 단추 */
    newComment: string
    postComment: string
    /** 답글 칸의 라벨 · 단추 */
    replyField: string
    postReply: string
    editField: string
    /** 지운 · 숨긴 댓글 자리에 보이는 글 */
    deleted: string
    hidden: string
    showReplies: (count: number) => string
    hideReplies: string
    required: string
    tooLong: (max: number) => string
    reactionGroup: string
    /** `authorRequired` 인데 작성자를 고르지 않고 보낼 때 칸 아래에 */
    authorRequired: string
    /** 선택기에 답이 필요한 질문이 떠 있는데 보내려 할 때 칸 아래에 */
    authorUnsettled: string
    /** 승인 대기 댓글에 붙는 표시 · 쓴 사람에게 보이는 안내 */
    pending: string
    pendingNote: string
    /** 대기 댓글을 공개한다(관리하는 쪽) */
    approve: string
    /** 댓글 첨부 목록의 이름 */
    attachments: string
    /** 비회원이 지울 때 묻는 비밀번호 칸 안내 */
    guestDeleteSecret: string
  }

export const defaultCommentLabels: CommentLabels = {
  ...defaultAuthorLabels,
  ...defaultGuestLabels,
  ...defaultRevisionLabels,
  reply: 'Reply',
  edit: 'Edit',
  delete: 'Delete',
  hide: 'Hide',
  restore: 'Restore',
  save: 'Save',
  cancel: 'Cancel',
  newComment: 'Write a comment',
  postComment: 'Post comment',
  replyField: 'Your reply',
  postReply: 'Post reply',
  editField: 'Edit comment',
  deleted: 'This comment was deleted.',
  hidden: 'This comment was hidden.',
  showReplies: (count) => (count === 1 ? 'Show 1 more reply' : `Show ${count} more replies`),
  hideReplies: 'Hide replies',
  required: 'Write something first.',
  tooLong: (max) => `Keep it within ${max} characters.`,
  reactionGroup: 'Reactions',
  authorRequired: 'Choose who to post as.',
  authorUnsettled: 'Answer the question about which nickname to use first.',
  pending: 'Waiting for approval',
  pendingNote: 'Only you and the people who manage this board can see it until it is approved.',
  approve: 'Approve',
  attachments: 'Attachments',
  guestDeleteSecret: 'Enter the password you used to post this comment.',
}
