import { ApiRequestError } from '@skeleton/api-client'
import type { PasswordPolicy } from '../account/types'

/*
 * 테스트 · 스토리가 함께 쓰는 만들기 도우미(공개 표면 아님). 스토리집을 뗀 프로젝트에서는 `stories/` 가 사라지므로 테스트가 기대는 것은 여기 둔다.
 */

export const FAKE_POLICY: PasswordPolicy = {
  minLength: 10,
  maxBytes: 72,
  requireLetter: true,
  requireDigit: true,
  requireSymbol: false,
  forbidEmailLocalPart: true,
}

/** 필드 오류가 있는 400(`errors[]`) — 서버의 message 는 영어다(화면은 그대로 보이지 않는다) */
export const fieldError = (field: string, code: string, message: string) =>
  new ApiRequestError(
    {
      code: 'COMMON.VALIDATION_FAILED',
      title: 'Validation failed',
      status: 400,
      timestamp: '2026-01-01T00:00:00Z',
      errors: [{ field, code, message }],
    } as never,
    'trace-demo',
    'span-demo',
    '00-trace-demo-span-demo-01',
  )

export const apiError = (code: string, status: number, data?: unknown) =>
  new ApiRequestError(
    { code, title: code, status, timestamp: '2026-01-01T00:00:00Z', data },
    'trace-demo',
    'span-demo',
    '00-trace-demo-span-demo-01',
  )
