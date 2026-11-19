import type { VideoItem } from './types'

/** 영상 한 줄이 화면에서 어느 단계인가 */
export type VideoPhase =
  | { phase: 'uploading' }
  | { phase: 'abandoned' }
  | { phase: 'processing'; percent: number | null }
  | { phase: 'ready' }
  | { phase: 'extras' }
  | { phase: 'failed'; failCode: string | null }
  | { phase: 'gone' }

const PROCESSING = new Set(['UPLOADED', 'QUEUED', 'REMUXING'])
const WORKING = new Set(['QUEUED', 'RUNNING'])

/**
 * `live` - 이 화면이 지금 올리고 있는 영상인가. `UPLOADING` 인데 아니면 올리다 만 채 남은 줄이다(한 시간 뒤 서버가 치운다).
 * 호환 · 사다리 트랙은 재생 가능이 된 뒤 따로 만들어진다 - 트랙이 실패해도 영상은 `ready` 다
 */
export function phaseOf(video: VideoItem, live: boolean): VideoPhase {
  switch (video.status) {
    case 'UPLOADING':
      return live ? { phase: 'uploading' } : { phase: 'abandoned' }
    case 'DELETED':
      return { phase: 'gone' }
    case 'FAILED':
      return { phase: 'failed', failCode: video.failCode }
    case 'PLAYABLE':
      return WORKING.has(video.compat) || WORKING.has(video.ladder)
        ? { phase: 'extras' }
        : { phase: 'ready' }
    default:
      return { phase: 'processing', percent: video.progress }
  }
}

/** 서버가 아직 만들고 있는 중인가 - 폴링할지 정한다 */
export function isBusy(video: VideoItem): boolean {
  if (PROCESSING.has(video.status)) return true
  return video.status === 'PLAYABLE' && (WORKING.has(video.compat) || WORKING.has(video.ladder))
}

export const POLL_MS = 3000

/** `useVideos` 의 `refetchInterval` - 만드는 중인 영상이 있으면 3초마다(`ms` 로 바꿀 수 있다), 없으면 멈춘다 */
export function pollInterval(videos: VideoItem[] | undefined, ms = POLL_MS): number | false {
  return videos?.some(isBusy) ? ms : false
}

export const FAIL_REASONS = [
  'UNSUPPORTED_FORMAT',
  'CORRUPT',
  'LIMITS_EXCEEDED',
  'TOO_BIG_FOR_WORKER',
  'PROCESSING_FAILED',
  'LEASE_EXPIRED',
  'UPLOAD_ABANDONED',
] as const
export type FailReason = (typeof FAIL_REASONS)[number]

/** 서버가 붙인 실패 사유 → 문구 표의 키. 모르는 사유는 일반 문구 */
export function failReasonKey(code: string | null): FailReason {
  return (FAIL_REASONS as readonly string[]).includes(code ?? '')
    ? (code as FailReason)
    : 'PROCESSING_FAILED'
}

/** `42000` → `0:42`, `3723000` → `1:02:03` */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
