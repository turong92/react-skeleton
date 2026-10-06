import { ApiRequestError } from '@skeleton/api-client'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LegalApi } from './legalApi'
import { documentQuery, documentsQuery, historyQuery, legalKeys, myConsentsQuery } from './queries'
import type { ConsentRequest, ConsentSource, ReadDocumentOptions } from './types'

/*
 * 얇은 훅 모음. 에러 표시는 앱의 QueryClient 전역 핸들러 · 화면이 한다(이 패키지는 토스트를 모른다).
 * 문서는 `Cache-Control: public, max-age=300` 이라 5분은 다시 가져오지 않는다.
 */
const FIVE_MINUTES = 5 * 60_000

/**
 * 다시 시도할까 — 모듈이 없는 백엔드의 답(401 · 403 · 404 · 405)은 다시 물어도 같다. 기본 재시도(3번 · 지수 대기, 약 7초)를 그대로 두면 가입 폼이 그동안 「불러오는 중」으로 막힌다(e2e 로 확인).
 * 일시 실패(네트워크 · 5xx)만 두 번 더 해 본다.
 */
export function legalRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && [401, 403, 404, 405].includes(error.apiError.status))
    return false
  return failureCount < 2
}

/** 현재 판 목록(종류 · 언어마다 한 줄) */
export function useLegalDocuments(api: LegalApi) {
  return useQuery({ ...documentsQuery(api), staleTime: FIVE_MINUTES, retry: legalRetry })
}

/** 문서 한 건 — `enabled` 가 false 면 열릴 때까지 가져오지 않는다(다이얼로그) */
export function useLegalDocument(
  api: LegalApi,
  type: string,
  options: ReadDocumentOptions & { enabled?: boolean } = {},
) {
  const { enabled = true, ...read } = options
  return useQuery({
    ...documentQuery(api, type, read),
    enabled,
    staleTime: FIVE_MINUTES,
    retry: legalRetry,
  })
}

/** 내 동의 상태 — 로그인한 사람만 부른다 */
export function useMyConsents(api: LegalApi, options: { enabled?: boolean } = {}) {
  return useQuery({ ...myConsentsQuery(api), enabled: options.enabled ?? true })
}

export function useConsentHistory(api: LegalApi, page: number, size = 10) {
  return useQuery({ ...historyQuery(api, page, size), placeholderData: keepPreviousData })
}

/** 동의 — 성공하면 내 상태를 서버가 돌려준 값으로 바꾼다 */
export function useAgree(api: LegalApi) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { consents: ConsentRequest[]; source?: ConsentSource }) =>
      api.agree(input.consents, input.source ?? 'settings'),
    onSuccess: (mine) => {
      client.setQueryData(myConsentsQuery(api).queryKey, mine)
      void client.invalidateQueries({ queryKey: [...legalKeys.consents(), 'history'] })
    },
  })
}

/** 선택 동의 철회 */
export function useWithdraw(api: LegalApi) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (type: string) => api.withdraw(type),
    onSuccess: (mine) => {
      client.setQueryData(myConsentsQuery(api).queryKey, mine)
      void client.invalidateQueries({ queryKey: [...legalKeys.consents(), 'history'] })
    },
  })
}
