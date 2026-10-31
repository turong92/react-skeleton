import { ApiRequestError } from '@skeleton/api-client'
import { legalKeys, type LegalApi } from '@skeleton/legal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PushApi } from '../pushApi'
import { advertisingQuery, pushKeys } from '../queries'
import type { PushAdvertising } from '../types'
import { agreementRequest, type ConsentKind } from './logic'

/** 이 백엔드에 광고 동의 경로가 없다(`notification-push-legal` 없음 · 광고 종류 미설정) */
export function isAdvertisingAbsent(error: unknown): boolean {
  return error instanceof ApiRequestError && [404, 405].includes(error.apiError.status)
}

/**
 * 광고 동의 상태 — 읽기에 실패하면 `data` 를 쓰지 말고(`isError`) 화면은 아무 스위치도 켠 것으로 보이지 않는다.
 * 경로가 없는(404) 백엔드는 다시 묻지 않는다.
 */
export function useAdvertising(push: PushApi) {
  return useQuery({
    ...advertisingQuery(push),
    retry: (count, error) => !isAdvertisingAbsent(error) && count < 1,
    meta: { quietStatuses: [404, 405] },
  })
}

/** 다시 읽는다 — 동의 · 철회 뒤에는 서버가 계산한 상태만 믿는다(낙관적 갱신 없음) */
function useRefresh() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: pushKeys.advertising() }),
      client.invalidateQueries({ queryKey: legalKeys.consents() }),
    ])
}

/** 동의 — 사용자가 읽은 판(`doc`)으로 `legal` 에 기록한다. 야간은 광고 동의 없이는 던진다 */
export function useAgreeAdvertising(legal: LegalApi) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: {
      ad: PushAdvertising
      kind: ConsentKind
      doc: { version: string; locale: string }
    }) => {
      const { consents, source } = agreementRequest(input.ad, input.kind, input.doc)
      return legal.agree(consents, source)
    },
    onSuccess: refresh,
  })
}

/** 철회 — 광고를 철회하면 야간 동의도 효력을 잃는다(서버 계산) */
export function useWithdrawAdvertising(legal: LegalApi) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: { ad: PushAdvertising; kind: ConsentKind }) =>
      legal.withdraw((input.kind === 'consent' ? input.ad.consent : input.ad.night).type),
    onSuccess: refresh,
  })
}
