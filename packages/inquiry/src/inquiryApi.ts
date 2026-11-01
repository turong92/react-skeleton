import type { ApiClient } from '@skeleton/api-client'
import type { InquiryInput, InquiryReceipt } from './types'

type InquiryClient = Pick<ApiClient, 'value'>

export type InquiryApi = {
  /**
   * `POST {base}` — 202. 로그인했으면 클라이언트가 액세스 토큰을 달아 계정이 붙고 사람 확인을 건너뛴다.
   * 앞뒤 공백을 떼고, 빈 선택 칸은 보내지 않는다. 400 `INQUIRY.INVALID`(`data.violations`) · 400 `INQUIRY.CAPTCHA_FAILED` · 429 `INQUIRY.TOO_MANY`
   */
  send(input: InquiryInput): Promise<InquiryReceipt>
}

export type InquiryApiOptions = {
  /** 컨트롤러 경로(기본 `/inquiries`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
}

/** 문의 HTTP 호출. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createInquiryApi(
  client: InquiryClient,
  { basePath = '/inquiries' }: InquiryApiOptions = {},
): InquiryApi {
  const base = basePath.replace(/\/+$/, '')
  return {
    send: ({ kind, body, lang, replyEmail, context, captchaToken }) =>
      client.value<InquiryReceipt>(base, {
        method: 'POST',
        json: {
          kind,
          body: body.trim(),
          ...(lang ? { lang } : {}),
          ...(replyEmail?.trim() ? { replyEmail: replyEmail.trim() } : {}),
          ...(context ? { context } : {}),
          ...(captchaToken ? { captchaToken } : {}),
        },
      }),
  }
}
