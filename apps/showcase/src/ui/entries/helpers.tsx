import { ApiRequestError } from '@skeleton/api-client'
import { Button, showApiError, toastPromise } from '@skeleton/ui'
import { Case } from '../../components/Section'
import type { UiEntry } from '../types'

const demoError = () =>
  new ApiRequestError(
    {
      code: 'COMMON.VALIDATION_FAILED',
      title: 'Validation failed',
      status: 400,
      detail: 'email format invalid',
      traceId: '7a8b9c0d1e2f',
      spanId: '0f1e2d3c',
      timestamp: '2026-01-01T00:00:00Z',
    },
    '7a8b9c0d1e2f',
    '0f1e2d3c',
    '00-7a8b9c0d1e2f-0f1e2d3c-01',
  )

const later = <T,>(value: T, ms: number, fail = false) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error('실패했습니다')) : resolve(value)), ms),
  )

export const helperEntries: UiEntry[] = [
  {
    name: 'showApiError',
    title: 'API 에러 토스트 — traceId 를 눌러 복사',
    render: () => (
      <Case label="ApiRequestError">
        <Button variant="secondary" onClick={() => showApiError(demoError())}>
          에러 토스트 띄우기
        </Button>
      </Case>
    ),
  },
  {
    name: 'toastPromise',
    title: '약속 하나 = 토스트 하나 (로딩 → 성공/실패)',
    render: () => (
      <Case label="success / failure">
        <Button
          variant="secondary"
          onClick={() =>
            void toastPromise(later('ok', 1200), { loading: '저장 중…', success: '저장했습니다' })
          }
        >
          성공하는 약속
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void toastPromise(later('no', 1200, true), {
              loading: '저장 중…',
              success: '저장했습니다',
            }).catch(() => undefined)
          }
        >
          실패하는 약속
        </Button>
      </Case>
    ),
  },
]
