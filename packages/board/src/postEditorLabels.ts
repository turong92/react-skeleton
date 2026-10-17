import { defaultCommentLabels } from './commentLabels'
import { defaultGuestLabels, type GuestLabels } from './guestLabels'

/** 글 폼의 글자 — 기본은 영어. 일부만 덮어쓰려면 `labels={{ title: '제목' }}` */
export type PostEditorLabels = GuestLabels & {
  title: string
  body: string
  requiredMark: string
  titleHint: (max: number) => string
  bodyHint: (max: number) => string
  titleRequired: string
  bodyRequired: string
  titleTooLong: (max: number) => string
  bodyTooLong: (max: number) => string
  cancel: string
  formLabel: string
  /** `authorRequired` 인데 작성자를 고르지 않았을 때 */
  authorRequired: string
  /** 선택기에 답이 필요한 질문이 떠 있는데 보내려 할 때 */
  authorUnsettled: string
}

export const defaultPostEditorLabels: PostEditorLabels = {
  ...defaultGuestLabels,
  title: 'Title',
  body: 'Body',
  requiredMark: '*',
  titleHint: (max) => `Up to ${max} characters`,
  bodyHint: (max) => `Up to ${max} characters`,
  titleRequired: 'Enter a title.',
  bodyRequired: 'Write something in the body.',
  titleTooLong: (max) => `Keep the title within ${max} characters.`,
  bodyTooLong: (max) => `Keep the body within ${max} characters.`,
  cancel: 'Cancel',
  formLabel: 'Post',
  authorRequired: defaultCommentLabels.authorRequired,
  authorUnsettled: defaultCommentLabels.authorUnsettled,
}
