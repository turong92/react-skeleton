import { ErrorCodes, isErrorCode } from '@skeleton/api-client'

export type InquiryProblem = 'invalid' | 'captcha' | 'tooMany' | 'other'

/** 문의 보내기 실패 하나를 한 낱말로 — 나머지는 `other`(일반 문장 + 참조 번호) */
export function inquiryProblem(error: unknown): InquiryProblem {
  if (isErrorCode(error, ErrorCodes.INQUIRY_INVALID)) return 'invalid'
  if (isErrorCode(error, ErrorCodes.INQUIRY_CAPTCHA_FAILED)) return 'captcha'
  if (isErrorCode(error, ErrorCodes.INQUIRY_TOO_MANY)) return 'tooMany'
  return 'other'
}
