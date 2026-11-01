export const INQUIRY_KINDS = ['QUESTION', 'FEATURE', 'BUG', 'OTHER'] as const
export type InquiryKind = (typeof INQUIRY_KINDS)[number]

/** 백엔드 `modules/inquiry` 의 한도 — 내용 10~2000자, 이메일 254자, context 100자 */
export const INQUIRY_BODY_MIN = 10
export const INQUIRY_BODY_MAX = 2000
export const INQUIRY_EMAIL_MAX = 254
export const INQUIRY_CONTEXT_MAX = 100

export type InquiryInput = {
  kind: InquiryKind
  body: string
  /** 화면 언어(`ko` · `en` · `ja`) — 서버가 모르는 값은 `ko` 로 둔다 */
  lang?: string
  replyEmail?: string
  /** 앱이 붙이는 선택 문자열(어느 화면에서 왔는지 …, ≤100자) — 서버는 뜻을 모른다 */
  context?: string
  /** 로그인하지 않은 호출의 사람 확인 토큰(서버에 Turnstile 이 켜져 있을 때) */
  captchaToken?: string | null
}

/** `POST /inquiries` 의 답 — 202 `{value: {status: 'RECEIVED'}}` */
export type InquiryReceipt = { status: string }
