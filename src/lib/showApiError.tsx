import { toast } from 'sonner'
import { ApiRequestError } from '../api/types'

/**
 * API 에러를 토스트로 표시.
 *
 * - [ApiRequestError] 면 title + detail + traceId 모두 표시
 * - 그 외 Error 는 그냥 message
 * - traceId 는 클릭 복사 가능 (디버깅/AI 문의 시 바로 붙여넣기)
 */
export function showApiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    const { title, detail, traceId, spanId } = error.apiError
    toast.error(title, {
      description: (
        <div>
          {detail && <div>{detail}</div>}
          {traceId && (
            <div
              style={{ marginTop: 8, fontSize: 12, fontFamily: 'monospace', cursor: 'copy' }}
              onClick={() => {
                navigator.clipboard.writeText(traceId)
                toast.success('traceId 복사됨')
              }}
              title="클릭하여 복사"
            >
              traceId: {traceId}
            </div>
          )}
          {spanId && (
            <div style={{ marginTop: 4, fontSize: 12, fontFamily: 'monospace' }}>
              spanId: {spanId}
            </div>
          )}
        </div>
      ),
    })
    return
  }

  const message = error instanceof Error ? error.message : String(error)
  toast.error(message)
}
