import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { BroadcastAdminApi } from './adminApi'
import type { BroadcastAudience, BroadcastInput, BroadcastStatus } from './types'

export const broadcastKeys = {
  all: ['notifications', 'broadcasts'] as const,
  options: () => [...broadcastKeys.all, 'options'] as const,
  audienceCount: (audience: BroadcastAudience) =>
    [...broadcastKeys.all, 'audience-count', audience.kind, audience.param ?? ''] as const,
  list: (status: BroadcastStatus | '') => [...broadcastKeys.all, 'list', status] as const,
  detail: (id: string) => [...broadcastKeys.all, 'detail', id] as const,
}

/** 한 번에 읽는 목록 줄 수 - 이만큼 꽉 차면 「더 보기」 가 다음 쪽을 연다 */
export const BROADCAST_PAGE_SIZE = 20

/** 보내는 동안 상세를 다시 읽는 간격(ms) */
export const SENDING_REFRESH_MS = 10_000

/**
 * 운영 조회의 공통 옵션 - 다시 시도하지 않고, 404(모듈의 `admin.enabled` 가 꺼진 서버)는 오류 토스트로 알리지 않는다
 * (화면이 제자리에서 「서버에서 이 도구가 꺼져 있어요」라고 말한다 - 앱의 `createQueryClient` 가 `meta.quietStatuses` 를 읽는다)
 */
const QUIET = { retry: false, meta: { quietStatuses: [404] } } as const

export const useBroadcastOptions = (api: Pick<BroadcastAdminApi, 'options'>) =>
  useQuery({ queryKey: broadcastKeys.options(), queryFn: () => api.options(), ...QUIET })

/** 값이 멈춘 지 `delayMs` 뒤에 따라온다 - 처음 값은 바로(`@skeleton/search` 의 `useDebouncedValue` 와 같은 일이나, 이 패키지는 검색에 기대지 않는다) */
export function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

/** 대상 수 미리보기 - 값을 치는 중의 400(`INVALID_AUDIENCE`)은 토스트 없이 화면 안 「세지 못했어요」 로 말한다. `enabled` 가 거짓(값을 아직 안 골랐다)이면 묻지 않는다 */
export const useAudienceCount = (
  api: Pick<BroadcastAdminApi, 'audienceCount'>,
  audience: BroadcastAudience,
  enabled: boolean,
) =>
  useQuery({
    queryKey: broadcastKeys.audienceCount(audience),
    queryFn: () => api.audienceCount(audience),
    enabled,
    ...QUIET,
    meta: { quietStatuses: [400, 404] },
  })

export const useBroadcasts = (
  api: Pick<BroadcastAdminApi, 'list'>,
  status: BroadcastStatus | '' = '',
) =>
  useInfiniteQuery({
    queryKey: broadcastKeys.list(status),
    queryFn: ({ pageParam }) =>
      api.list({
        ...(status ? { status } : {}),
        ...(pageParam ? { before: pageParam } : {}),
        limit: BROADCAST_PAGE_SIZE,
      }),
    initialPageParam: '',
    getNextPageParam: (last) =>
      last.length >= BROADCAST_PAGE_SIZE ? last[last.length - 1]?.id : undefined,
    ...QUIET,
  })

/** 상세 + 통계 - 보내는 중(SENDING)이면 10초마다 다시 읽는다 */
export const useBroadcast = (api: Pick<BroadcastAdminApi, 'get'>, id: string | undefined) =>
  useQuery({
    queryKey: broadcastKeys.detail(id ?? ''),
    queryFn: () => api.get(id ?? ''),
    enabled: id !== undefined,
    refetchInterval: (query) =>
      query.state.data?.status === 'SENDING' ? SENDING_REFRESH_MS : false,
    ...QUIET,
  })

type MutationApi = Pick<
  BroadcastAdminApi,
  'create' | 'update' | 'remove' | 'sendTest' | 'send' | 'unschedule' | 'cancel' | 'resume'
>

/** 만들기 · 고치기 · 지우기 · 시험 · 보내기 · 예약 풀기 · 취소 · 이어 보내기 - 성공하면 공지 조회를 모두 다시 읽는다 */
export function useBroadcastMutations(api: MutationApi) {
  const client = useQueryClient()
  const done = () => client.invalidateQueries({ queryKey: broadcastKeys.all })
  return {
    create: useMutation({
      mutationFn: (input: BroadcastInput) => api.create(input),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: BroadcastInput }) => api.update(id, input),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.remove(id), onSuccess: done }),
    sendTest: useMutation({ mutationFn: (id: string) => api.sendTest(id) }),
    send: useMutation({
      mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: string | null }) =>
        api.send(id, scheduledAt),
      onSuccess: done,
    }),
    unschedule: useMutation({ mutationFn: (id: string) => api.unschedule(id), onSuccess: done }),
    cancel: useMutation({ mutationFn: (id: string) => api.cancel(id), onSuccess: done }),
    resume: useMutation({ mutationFn: (id: string) => api.resume(id), onSuccess: done }),
  }
}
