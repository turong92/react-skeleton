import { INQUIRY_BODY_MAX, INQUIRY_BODY_MIN, INQUIRY_EMAIL_MAX } from './types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type InquiryFieldProblems = { body?: 'length'; email?: 'format' }

/** 서버와 같은 규칙으로 칸의 틀린 곳을 가린다 — 내용은 앞뒤 공백을 뗀 길이가 한도 안, 이메일은 비었거나 모양이 맞다 */
export function inquiryFieldProblems(input: { body: string; email: string }): InquiryFieldProblems {
  const problems: InquiryFieldProblems = {}
  const body = input.body.trim()
  if (body.length < INQUIRY_BODY_MIN || body.length > INQUIRY_BODY_MAX) problems.body = 'length'
  const email = input.email.trim()
  if (email !== '' && (email.length > INQUIRY_EMAIL_MAX || !EMAIL.test(email))) {
    problems.email = 'format'
  }
  return problems
}
