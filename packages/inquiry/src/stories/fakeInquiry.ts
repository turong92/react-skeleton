import { ApiRequestError } from '@skeleton/api-client'
import type { InquiryApi } from '../inquiryApi'
import type { InquiryInput } from '../types'

export type FakeInquiryOptions = {
  /** 이 코드로 모든 보내기가 실패한다(`INQUIRY.TOO_MANY` …) */
  failWith?:
    | 'INQUIRY.INVALID'
    | 'INQUIRY.CAPTCHA_FAILED'
    | 'INQUIRY.TOO_MANY'
    | 'COMMON.INTERNAL_ERROR'
}

const STATUS = {
  'INQUIRY.INVALID': 400,
  'INQUIRY.CAPTCHA_FAILED': 400,
  'INQUIRY.TOO_MANY': 429,
  'COMMON.INTERNAL_ERROR': 500,
} as const

/** 스토리용 가짜 서버 — 받은 문의를 `sent` 에 쌓는다 */
export function createFakeInquiry({ failWith }: FakeInquiryOptions = {}) {
  const sent: InquiryInput[] = []
  const api: InquiryApi = {
    send: async (input) => {
      if (failWith) {
        throw new ApiRequestError(
          {
            code: failWith,
            title: failWith,
            status: STATUS[failWith],
            timestamp: '2026-11-01T00:00:00Z',
          },
          'trace',
          'span',
          'traceparent',
        )
      }
      sent.push(input)
      return { status: 'RECEIVED' }
    },
  }
  return { api, sent }
}
