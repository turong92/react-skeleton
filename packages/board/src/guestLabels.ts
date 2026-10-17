/** 비회원 칸의 글자 — 댓글 폼 · 글 폼이 같이 쓴다. 기본은 영어 */
export type GuestLabels = {
  guestName: string
  guestNameRequired: string
  guestNameTooLong: (max: number) => string
  guestSecret: string
  /** 비밀번호 칸 아래 설명 — 고치기 · 지우기에 다시 필요하다는 것 */
  guestSecretHint: string
  guestSecretRequired: string
  guestCaptchaRequired: string
  /** 비회원이 승인 대기 글 · 댓글을 보낸 직후 */
  guestPending: string
  /** 비회원이 고치기를 보낸 직후(승인 대상) */
  guestEditPending: string
}

export const defaultGuestLabels: GuestLabels = {
  guestName: 'Your name',
  guestNameRequired: 'Enter a name.',
  guestNameTooLong: (max) => `Keep the name within ${max} characters.`,
  guestSecret: 'Password',
  guestSecretHint: 'You need it again to edit or delete this.',
  guestSecretRequired: 'Enter a password of at least 4 characters.',
  guestCaptchaRequired: 'Complete the check first.',
  guestPending: 'Thanks. It will show up once it is approved.',
  guestEditPending: 'Your edit will show up once it is approved.',
}

/** 고친 내용이 승인을 기다릴 때의 글자 — 글 상세 · 댓글이 같이 쓴다 */
export type RevisionLabels = {
  /** 쓴 사람에게 */
  revisionWaiting: string
  /** 운영자 · 관리하는 사람에게 — 공개본과 고친 내용을 나란히 */
  revisionReview: string
  revisionCurrent: string
  revisionEdited: string
  approveEdit: string
  rejectEdit: string
}

export const defaultRevisionLabels: RevisionLabels = {
  revisionWaiting: 'Your edit is waiting for approval. Everyone else still sees the earlier text.',
  revisionReview: 'An edit is waiting for approval.',
  revisionCurrent: 'Published now',
  revisionEdited: 'Edited',
  approveEdit: 'Approve edit',
  rejectEdit: 'Reject edit',
}
