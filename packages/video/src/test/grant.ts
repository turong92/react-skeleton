import type { VideoPlayback } from '../types'

/** 시험용 재생 허가 - 마스터 · 원본 단 · 호환 단이 다 있는 공개 영상 */
export function fakeGrant(overrides: Partial<VideoPlayback> = {}): VideoPlayback {
  return {
    src: 'https://cdn.test/v/a/o-1/index.m3u8',
    compat: 'https://cdn.test/v/a/c-1/index.m3u8',
    hls: 'https://cdn.test/v/a/h-1/master.m3u8',
    poster: 'https://cdn.test/v/a/p-1.jpg',
    codec: 'avc1.640028',
    w: 1080,
    h: 1920,
    durationMs: 42_000,
    big: false,
    ...overrides,
  }
}
