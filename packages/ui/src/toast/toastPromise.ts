import { ApiRequestError } from '@skeleton/api-client'
import { toast } from 'sonner'

export type ToastOptions = { id?: string | number; description?: string }

/** sonner 의 `toast` 에서 쓰는 부분 — 테스트에서 가짜로 바꾼다 */
export type ToastLike = {
  loading(message: string, options?: ToastOptions): string | number
  success(message: string, options?: ToastOptions): unknown
  error(message: string, options?: ToastOptions): unknown
}

export type ToastPromiseMessages<T> = {
  loading: string
  success: string | ((value: T) => string)
  /** 없으면 에러에서 뽑는다(`ApiRequestError` → title + detail, 그 외 → message) */
  error?: string | ((error: unknown) => string)
}

function describeError(error: unknown): { title: string; description?: string } {
  if (error instanceof ApiRequestError) {
    const { title, detail } = error.apiError
    return { title, description: detail ?? undefined }
  }
  return { title: error instanceof Error ? error.message : String(error) }
}

/**
 * 약속 하나를 토스트 하나로 보여 준다 — 「로딩 → 성공/실패」가 같은 토스트 자리에서 바뀐다.
 * 값은 그대로 돌려주고 실패는 다시 던진다(호출자가 이어서 처리한다).
 * 전역 에러 토스트(`showApiError`)와 같은 에러를 두 번 띄우지 않으려면 이 약속은 전역 핸들러를 거치지 않는 호출에 쓴다.
 */
export async function toastPromise<T>(
  promise: Promise<T>,
  messages: ToastPromiseMessages<T>,
  toaster: ToastLike = toast,
): Promise<T> {
  const id = toaster.loading(messages.loading)
  try {
    const value = await promise
    toaster.success(
      typeof messages.success === 'function' ? messages.success(value) : messages.success,
      { id },
    )
    return value
  } catch (error) {
    const own = typeof messages.error === 'function' ? messages.error(error) : messages.error
    const { title, description } = describeError(error)
    toaster.error(own ?? title, { id, description: own ? undefined : description })
    throw error
  }
}
