/** 백엔드 `PermissionDeclaration("review", …)` — `review.moderate` 는 MODERATOR 기본 포함, `review.reply` 는 전권만 */
export const REVIEW_PERMISSIONS = {
  moderate: 'review.moderate',
  reply: 'review.reply',
} as const

/** 부품이 받는 권한 질문 - 주지 않으면 모두 true. 서버가 다시 판정하니 화면은 단추를 숨길 뿐이다 */
export type CanFn = (key: string) => boolean
export const allowAll: CanFn = () => true
