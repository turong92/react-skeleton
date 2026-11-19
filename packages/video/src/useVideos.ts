import { useQuery } from '@tanstack/react-query'
import { POLL_MS, pollInterval } from './videoView'
import type { VideoApi } from './videoApi'

/** 목적(`purpose`)별 목록의 캐시 키 - 올린 뒤 · 지운 뒤 `invalidateQueries({ queryKey: videosKey(purpose) })` */
export const videosKey = (purpose: string) => ['videos', purpose] as const

/**
 * 내 영상 목록(한 목적). 서버가 아직 만드는 중인 영상(처리 중 · 호환 / 사다리 판 만드는 중)이 있으면 3초마다 다시 읽고, 없으면 멈춘다.
 * `QueryClientProvider` 안에서 쓴다. `pollMs` 는 시험 · 스토리에서 간격을 줄일 때만
 */
export function useVideos(api: Pick<VideoApi, 'list'>, purpose: string, { pollMs = POLL_MS } = {}) {
  return useQuery({
    queryKey: videosKey(purpose),
    queryFn: () => api.list(purpose),
    refetchInterval: (query) => pollInterval(query.state.data, pollMs),
  })
}
