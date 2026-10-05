import { showApiError as showApiErrorToast } from '@skeleton/ui'

/** 워크벤치의 토스트 문구(한국어). `@skeleton/ui` 는 문구를 prop 으로 받고 기본값은 영어다 */
export function showApiError(error: unknown) {
  showApiErrorToast(error, {
    messages: { traceIdCopied: 'traceId 복사됨', clickToCopy: '클릭하여 복사' },
  })
}
