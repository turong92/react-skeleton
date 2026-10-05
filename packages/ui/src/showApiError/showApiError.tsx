import { ApiRequestError } from '@skeleton/api-client'
import { toast } from 'sonner'
import styles from './showApiError.module.css'

export type ApiErrorMessages = {
  /** traceId 를 클립보드에 복사했을 때 토스트(기본 `traceId copied`) */
  traceIdCopied: string
  /** traceId 에 마우스를 올렸을 때 말풍선(기본 `Click to copy`) */
  clickToCopy: string
}

const DEFAULT_MESSAGES: ApiErrorMessages = {
  traceIdCopied: 'traceId copied',
  clickToCopy: 'Click to copy',
}

export type ShowApiErrorOptions = {
  messages?: Partial<ApiErrorMessages>
}

/**
 * API 에러를 토스트로 표시.
 *
 * - [ApiRequestError] 면 title + detail + traceId 모두 표시
 * - 그 외 Error 는 그냥 message
 * - traceId 는 클릭 복사 가능 (디버깅/AI 문의 시 바로 붙여넣기)
 * - 사용자에게 보이는 문구는 `options.messages` 로 바꾼다(기본 영어)
 */
export function showApiError(error: unknown, options: ShowApiErrorOptions = {}) {
  const messages = { ...DEFAULT_MESSAGES, ...options.messages }

  if (error instanceof ApiRequestError) {
    const { title, detail, traceId, spanId } = error.apiError
    toast.error(title, {
      description: (
        <div>
          {detail && <div>{detail}</div>}
          {traceId && (
            <div
              className={`${styles.trace} ${styles.copy}`}
              onClick={() => {
                navigator.clipboard.writeText(traceId)
                toast.success(messages.traceIdCopied)
              }}
              title={messages.clickToCopy}
            >
              traceId: {traceId}
            </div>
          )}
          {spanId && <div className={styles.trace}>spanId: {spanId}</div>}
        </div>
      ),
    })
    return
  }

  const message = error instanceof Error ? error.message : String(error)
  toast.error(message)
}
