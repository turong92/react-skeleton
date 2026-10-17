import type {
  BoardCommentsLabelsInput,
  PostDetailLabels,
  PostEditorLabels,
  PostListLabelsInput,
} from '@skeleton/board'
import type { useT } from '../i18n'

type Translate = ReturnType<typeof useT>['t']

/*
 * `@skeleton/board` 부품의 글자 — 부품은 i18n 을 모르고 글자는 prop 이라, 화면이 지금 언어의 사전(`t`)에서 골라 넘긴다.
 * 반응 종류는 서버 설정(skeleton.board.reaction.types)이 정한 코드이고, 글자는 사전의 `board.reactions.<코드>`, 아이콘은 아래 맵이다.
 * 종류를 더하면: 사전 두 언어에 한 줄씩 + 아래 두 맵에 한 줄(없으면 코드가 그대로 글자로 보인다).
 */
const REACTION_CODES = ['LIKE', 'DISLIKE', 'EMPATHY'] as const

export const REACTION_ICONS: Record<string, string> = { LIKE: '👍', DISLIKE: '👎', EMPATHY: '🤝' }

export const reactionLabels = (t: Translate): Record<string, string> =>
  Object.fromEntries(REACTION_CODES.map((code) => [code, t(`board.reactions.${code}`)]))

/** 작성자 자리의 글자 — 삭제된 사용자(지운 프로필 · 탈퇴한 계정) · 익명(계정 id 도 프로필 id 도 어디에도 그리지 않는다) */
const authorLabels = (t: Translate) => ({
  authorDeleted: t('board.author.deleted'),
  authorUnnamed: t('board.author.unnamed'),
  authorGuest: t('board.author.guest'),
})

/** 비회원 칸 · 고친 내용 승인 대기의 글자 */
const guestLabels = (t: Translate) => ({
  guestName: t('board.guest.name'),
  guestNameRequired: t('board.guest.nameRequired'),
  guestNameTooLong: (max: number) => t('board.guest.nameTooLong', { max }),
  guestSecret: t('board.guest.secret'),
  guestSecretHint: t('board.guest.secretHint'),
  guestSecretRequired: t('board.guest.secretRequired'),
  guestCaptchaRequired: t('board.guest.captchaRequired'),
  guestPending: t('board.guest.pending'),
  guestEditPending: t('board.guest.editPending'),
})

export const guestFieldLabels = guestLabels

const revisionLabels = (t: Translate) => ({
  revisionWaiting: t('board.revision.waiting'),
  revisionReview: t('board.revision.review'),
  revisionCurrent: t('board.revision.current'),
  revisionEdited: t('board.revision.edited'),
  approveEdit: t('board.revision.approve'),
  rejectEdit: t('board.revision.reject'),
})

const pageLabel = (t: Translate) => (page: number) => t('board.page', { page })

export const postListLabels = (t: Translate): PostListLabelsInput => ({
  caption: t('board.list.caption'),
  title: t('board.list.title'),
  author: t('board.list.author'),
  ...authorLabels(t),
  comments: t('board.list.comments'),
  reactions: t('board.list.reactions'),
  views: t('board.list.views'),
  posted: t('board.list.posted'),
  pinned: t('board.list.pinned'),
  status: postStatusLabels(t),
  search: t('board.list.search'),
  searchPlaceholder: t('board.list.searchPlaceholder'),
  searchSubmit: t('board.list.searchSubmit'),
  sort: t('board.list.sort'),
  sorts: {
    latest: t('board.list.sort.latest'),
    reactions: t('board.list.sort.reactions'),
    comments: t('board.list.sort.comments'),
  },
  errorTitle: t('board.list.errorTitle'),
  errorDescription: t('board.list.errorDescription'),
  emptyTitle: t('board.list.emptyTitle'),
  emptyDescription: t('board.list.emptyDescription'),
  noResultsTitle: t('board.list.noResultsTitle'),
  noResultsDescription: t('board.list.noResultsDescription'),
  clearSearch: t('board.list.clearSearch'),
  loading: t('common.loading'),
  retry: t('common.retry'),
  pagination: {
    label: t('notes.pagination.label'),
    previous: t('notes.pagination.previous'),
    next: t('notes.pagination.next'),
    page: pageLabel(t),
  },
})

const postStatusLabels = (t: Translate): PostDetailLabels['status'] => ({
  DRAFT: t('board.status.DRAFT'),
  PENDING: t('board.status.PENDING'),
  PUBLISHED: t('board.status.PUBLISHED'),
  HIDDEN: t('board.status.HIDDEN'),
  DELETED: t('board.status.DELETED'),
})

export const postDetailLabels = (t: Translate): PostDetailLabels => ({
  ...authorLabels(t),
  ...revisionLabels(t),
  pendingNote: t('board.pending.post'),
  edit: t('board.detail.edit'),
  delete: t('board.detail.delete'),
  pin: t('board.detail.pin'),
  unpin: t('board.detail.unpin'),
  hide: t('board.detail.hide'),
  restore: t('board.detail.restore'),
  pinned: t('board.list.pinned'),
  status: postStatusLabels(t),
  views: (count) => t('board.detail.views', { count }),
  attachments: (count) => t('board.detail.attachments', { count }),
})

/** `mustCreate` — 이름 있는 프로필이 하나도 없어 고를 것이 없다: 「골라 주세요」 대신 「먼저 만들어 주세요」 */
export const postEditorLabels = (t: Translate, mustCreate = false): Partial<PostEditorLabels> => ({
  title: t('board.form.title'),
  body: t('board.form.body'),
  requiredMark: t('board.form.required'),
  titleHint: (max) => t('board.form.titleHint', { max }),
  bodyHint: (max) => t('board.form.bodyHint', { max }),
  titleRequired: t('board.form.titleRequired'),
  bodyRequired: t('board.form.bodyRequired'),
  titleTooLong: (max) => t('board.form.titleTooLong', { max }),
  bodyTooLong: (max) => t('board.form.bodyTooLong', { max }),
  cancel: t('common.cancel'),
  formLabel: t('board.form.formLabel'),
  authorRequired: t(mustCreate ? 'board.authorRequiredCreate' : 'board.authorRequired'),
  authorUnsettled: t('board.authorUnsettled'),
  ...guestLabels(t),
})

export const commentLabels = (t: Translate, mustCreate = false): BoardCommentsLabelsInput => ({
  ...authorLabels(t),
  ...guestLabels(t),
  ...revisionLabels(t),
  pending: t('board.pending.badge'),
  pendingNote: t('board.pending.comment'),
  approve: t('board.comments.approve'),
  attachments: t('board.comments.attachments'),
  guestDeleteSecret: t('board.guest.deleteSecret'),
  heading: t('board.comments.heading'),
  sort: t('board.comments.sort'),
  sorts: {
    oldest: t('board.comments.sort.oldest'),
    latest: t('board.comments.sort.latest'),
    reactions: t('board.comments.sort.reactions'),
  },
  empty: t('board.comments.empty'),
  loadError: t('board.comments.loadError'),
  reply: t('board.comments.reply'),
  edit: t('board.comments.edit'),
  delete: t('board.comments.delete'),
  hide: t('board.comments.hide'),
  restore: t('board.comments.restore'),
  save: t('board.comments.save'),
  newComment: t('board.comments.newComment'),
  postComment: t('board.comments.postComment'),
  replyField: t('board.comments.replyField'),
  postReply: t('board.comments.postReply'),
  editField: t('board.comments.editField'),
  deleted: t('board.comments.deleted'),
  hidden: t('board.comments.hidden'),
  showReplies: (count) => t('board.comments.showReplies', { count }),
  hideReplies: t('board.comments.hideReplies'),
  required: t('board.comments.required'),
  tooLong: (max) => t('board.comments.tooLong', { max }),
  confirmDeleteTitle: t('board.comments.confirmDeleteTitle'),
  confirmDeleteBody: t('board.comments.confirmDeleteBody'),
  confirmDelete: t('board.comments.confirmDelete'),
  reactionGroup: t('board.reactions.group'),
  loading: t('common.loading'),
  retry: t('common.retry'),
  cancel: t('common.cancel'),
  close: t('common.close'),
  authorRequired: t(mustCreate ? 'board.authorRequiredCreate' : 'board.authorRequired'),
  authorUnsettled: t('board.authorUnsettled'),
  pagination: { label: t('notes.pagination.label'), page: pageLabel(t) },
})
