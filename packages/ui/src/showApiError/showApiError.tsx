import { ApiRequestError } from '@skeleton/api-client'
import { toast } from 'sonner'
import { ErrorReference } from '../ErrorReference/ErrorReference'
import { errorReferenceOf } from '../ErrorReference/errorReferenceOf'
import styles from './showApiError.module.css'

export type ApiErrorMessages = {
  /** traceId 를 클립보드에 복사했을 때 알림(기본 `traceId copied`) */
  traceIdCopied: string
  /** 복사 버튼 글자(기본 `Copy`) */
  copy: string
  /** 복사 버튼에 마우스를 올렸을 때 말풍선(기본 `Click to copy`) */
  clickToCopy: string
}

const DEFAULT_MESSAGES: ApiErrorMessages = {
  traceIdCopied: 'traceId copied',
  copy: 'Copy',
  clickToCopy: 'Click to copy',
}

export type ShowApiErrorOptions = {
  messages?: Partial<ApiErrorMessages>
}

/**
 * API 에러를 토스트로 표시하고, 참조 번호(traceId)를 돌려준다.
 *
 * - [ApiRequestError] 면 title + detail + traceId 모두 표시
 * - 그 외 Error 는 그냥 message
 * - traceId 는 복사 버튼(키보드로 닿는다)으로 복사 (디버깅/AI 문의 시 바로 붙여넣기)
 * - 돌려준 번호를 상태에 담아 `<ErrorReference reference=… />` 로 그리면 토스트가 사라진 뒤에도 화면에 남는다
 * - 사용자에게 보이는 문구는 `options.messages` 로 바꾼다(기본 영어)
 */
export function showApiError(
  error: unknown,
  options: ShowApiErrorOptions = {},
): string | undefined {
  const messages = { ...DEFAULT_MESSAGES, ...options.messages }

  if (error instanceof ApiRequestError) {
    const { title, detail, traceId, spanId } = error.apiError
    toast.error(title, {
      description: (
        <div>
          {detail && <div>{detail}</div>}
          {traceId && (
            <ErrorReference
              reference={traceId}
              label="traceId"
              copyLabel={messages.copy}
              copiedLabel={messages.traceIdCopied}
              copyHint={messages.clickToCopy}
              className={styles.trace}
            />
          )}
          {spanId && <div className={styles.trace}>spanId: {spanId}</div>}
        </div>
      ),
    })
    return errorReferenceOf(error)
  }

  const message = error instanceof Error ? error.message : String(error)
  toast.error(message)
  return undefined
}
