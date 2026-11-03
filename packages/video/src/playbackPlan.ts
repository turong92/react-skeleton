import type { VideoPlayback } from './types'

/** 재생 한 걸음 - 마스터(자동) · 원본 단 · 호환 단 */
export type PlaybackKind = 'hls' | 'orig' | 'compat'

/** 화질 칩에서 고르는 것 - 자동은 기본 순서의 첫 걸음 */
export type QualityChoice = 'auto' | 'compat' | 'orig'

/** 이 기기가 무엇을 트는가 - 브라우저에서 읽어 오고, 시험 · 스토리에서는 바꿔 끼운다 */
export type PlaybackEnv = {
  /** `HTMLVideoElement.canPlayType` 이 빈 글자가 아닌가 */
  canPlayType: (mime: string) => boolean
  /** MSE(`MediaSource` · `ManagedMediaSource`) - 없으면 null */
  mse: { isTypeSupported: (type: string) => boolean } | null
}

export type PlaybackPlan = {
  /** `native` = 브라우저가 HLS 를 튼다, `hlsjs` = MSE 위에 hls.js, 둘 다 없으면 null */
  engine: 'native' | 'hlsjs' | null
  /** 시도할 순서 - 비면 틀 수 있는 판이 아직 없다 */
  order: PlaybackKind[]
  /** 화질 칩에 보일 것(둘 이상일 때만 칩이 뜬다) */
  options: QualityChoice[]
  /** 큰 원본인데 호환 단이 아직 없다 - 칩의 720p 를 「준비 중」으로 흐리게 보인다 */
  compatPending: boolean
}

const HLS_MIME = 'application/vnd.apple.mpegurl'

/**
 * 재생 순서(설계 0-15) - 마스터 → (이 기기가 원본 코덱을 틀면) 원본 단 → 호환 단.
 * 큰 원본(`big`)은 호환 단이 있으면 호환 단을 기본으로 하고 원본은 칩에서 고를 때만 받는다.
 * 코덱 판별은 엔진이 실제로 트는 길로 - 네이티브는 `canPlayType`, hls.js 는 MSE 의 `isTypeSupported`
 */
export function planPlayback(grant: VideoPlayback, env: PlaybackEnv): PlaybackPlan {
  const engine = env.canPlayType(HLS_MIME) ? 'native' : env.mse ? 'hlsjs' : null
  const mime = grant.codec ? `video/mp4; codecs="${grant.codec}"` : 'video/mp4'
  const origOk =
    engine === 'native'
      ? env.canPlayType(mime)
      : engine === 'hlsjs' && env.mse!.isTypeSupported(mime)
  const order: PlaybackKind[] = []
  if (engine) {
    if (grant.hls) order.push('hls')
    if (origOk && !(grant.compat && grant.big)) order.push('orig')
    if (grant.compat) order.push('compat')
    if (origOk && !order.includes('orig')) order.push('orig')
  }
  const compatPending = Boolean(grant.big && !grant.compat && origOk)
  const options: QualityChoice[] = ['auto']
  if ((order.includes('compat') && order[0] !== 'compat') || compatPending) options.push('compat')
  if (origOk && order.includes('orig') && order[0] !== 'orig') options.push('orig')
  return { engine, order, options, compatPending }
}

/** 토큰이 곧(30초 안에) 끝나거나 이미 끝났나 - 공개 영상(`expiresAt` 없음)은 끝나지 않는다 */
export function grantExpired(grant: VideoPlayback, now: number): boolean {
  if (!grant.expiresAt) return false
  const at = Date.parse(grant.expiresAt)
  return Number.isFinite(at) && at - 30_000 <= now
}

export type FailureDecision =
  | { action: 'refresh' }
  | { action: 'next'; kind: PlaybackKind }
  | { action: 'give-up' }

/**
 * 한 걸음이 틀지 못했을 때 - 토큰이 끝난 탓이면 새 재생 허가를 받아 같은 걸음을 같은 시각에서 한 번 더(`refreshed` 가 한 번만 허락),
 * 아니면 아직 안 해 본 다음 걸음, 다 해 봤으면 포기
 */
export function afterFailure(input: {
  grant: VideoPlayback
  order: readonly PlaybackKind[]
  tried: readonly PlaybackKind[]
  now: number
  canRefresh: boolean
  refreshed: boolean
}): FailureDecision {
  const { grant, order, tried, now, canRefresh, refreshed } = input
  if (canRefresh && !refreshed && grantExpired(grant, now)) return { action: 'refresh' }
  const next = order.find((kind) => !tried.includes(kind))
  return next ? { action: 'next', kind: next } : { action: 'give-up' }
}

/** 걸음에 해당하는 재생 목록 주소 */
export function urlOf(grant: VideoPlayback, kind: PlaybackKind): string {
  return kind === 'hls' ? grant.hls! : kind === 'compat' ? grant.compat! : grant.src
}
