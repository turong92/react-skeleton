import type { VideoPlayback } from './types'

/**
 * 재생기가 받는 주소 묶음 - 서버 재생 허가 없이 같은 출처 주소(쿠키 인증)를 그대로 트는 앱은 이것만 넘긴다.
 * 서명 주소 · 토큰 만료 처리는 `VideoPlayback`(재생 허가) 쪽에만 남는다
 */
export type PlayerSource = {
  /** 원본 단 재생 목록 */
  src: string
  /** 소리 판 재생 목록 - 있을 때만 「영상 / 노래」 전환이 뜬다 */
  audio?: string | null
  poster?: string
  /** 호환 단 재생 목록 */
  compat?: string
  /** 원본 단의 코덱 문자열(`avc1.640028,mp4a.40.2` - `VideoPlayback.codec` 과 같은 모양) - 알면 이 기기가 못 트는 원본을 처음부터 건너뛴다. 모르면 비워 두면 일단 틀어 보고 실패하면 다음 걸음으로 간다 */
  codec?: string
  /** 마스터(자동) 재생 목록 */
  hls?: string
}

/** 서버 재생 허가를 주소 묶음으로 - 허가가 `PlayerSource` 를 받는 쪽에 붙는 유일한 길 */
export function playerSourceOf(grant: VideoPlayback): PlayerSource {
  const source: PlayerSource = { src: grant.src }
  if (grant.audio) source.audio = grant.audio
  if (grant.poster) source.poster = grant.poster
  if (grant.compat) source.compat = grant.compat
  if (grant.codec) source.codec = grant.codec
  if (grant.hls) source.hls = grant.hls
  return source
}

/** 주소 묶음을 재생기 안쪽이 쓰는 모양으로 - 모르는 것(코덱 · 크기 · 길이)은 비워 두고 만료는 없다 */
export function playbackOf(source: PlayerSource): VideoPlayback {
  return {
    src: source.src,
    audio: source.audio,
    compat: source.compat,
    hls: source.hls,
    poster: source.poster ?? '',
    codec: source.codec ?? '',
    w: 0,
    h: 0,
    durationMs: 0,
    big: false,
  }
}
