import type { PartPut } from '../putPart'
import type { VideoItem, VideoPlayback } from '../types'
import type { VideoApi } from '../videoApi'

const MB = 1024 * 1024

/** 스토리용 재생 허가 - 마스터 · 원본 단 · 호환 단이 다 있다. 주소는 이 스토리 안에서만 의미가 있다 */
export function storyGrant(overrides: Partial<VideoPlayback> = {}): VideoPlayback {
  return {
    src: 'https://video.test/v/a/o-1/index.m3u8',
    compat: 'https://video.test/v/a/c-1/index.m3u8',
    hls: 'https://video.test/v/a/h-1/master.m3u8',
    poster:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640"><rect width="100%" height="100%" fill="#2b3a4a"/></svg>',
      ),
    codec: 'avc1.640028',
    w: 360,
    h: 640,
    durationMs: 42_000,
    big: false,
    ...overrides,
  }
}

export function storyItem(overrides: Partial<VideoItem> = {}): VideoItem {
  return {
    id: 'seed-1',
    purpose: 'clip',
    visibility: 'PRIVATE',
    status: 'PLAYABLE',
    bytes: 20 * MB,
    compat: 'READY',
    ladder: 'READY',
    progress: null,
    failCode: null,
    width: 1080,
    height: 1920,
    durationMs: 42_000,
    createdAt: '2026-11-04T00:00:00Z',
    ...overrides,
  }
}

/**
 * 가짜 서버 + 가짜 저장소. 올리면 `QUEUED` → `REMUXING`(30%, 70%) → `PLAYABLE`(호환 판 만드는 중) → 다 준비됨 순서로 `stepMs` 마다 한 단계씩 간다.
 * 실패 · 올리다 만 줄은 `items` 로 미리 넣어 둔다. `putMs` 는 조각 하나를 올리는 데 걸리는 시간(진행률 막대를 볼 시간)
 */
export function createFakeVideoBackend({
  items = [],
  stepMs = 300,
  putMs = 5,
}: { items?: VideoItem[]; stepMs?: number; putMs?: number } = {}) {
  let videos = [...items]
  let counter = 0
  const update = (id: string, change: Partial<VideoItem>) => {
    videos = videos.map((v) => (v.id === id ? { ...v, ...change } : v))
  }
  const later = (ms: number, run: () => void) => void setTimeout(run, ms)

  const api: VideoApi = {
    start: async ({ bytes, purpose, visibility }) => {
      counter += 1
      const id = `fake-${counter}`
      videos = [
        ...videos,
        storyItem({
          id,
          purpose,
          visibility,
          status: 'UPLOADING',
          bytes,
          compat: 'NONE',
          ladder: 'NONE',
          width: null,
          height: null,
          durationMs: null,
        }),
      ]
      return { id, uploadId: `u-${counter}`, partSize: MB }
    },
    presignParts: async (_id, numbers) =>
      numbers.map((number) => ({
        number,
        method: 'PUT',
        url: `https://store.test/p${number}`,
        headers: {},
      })),
    listParts: async () => [],
    complete: async (id) => {
      update(id, { status: 'QUEUED' })
      later(stepMs, () => update(id, { status: 'REMUXING', progress: 30 }))
      later(stepMs * 2, () => update(id, { status: 'REMUXING', progress: 70 }))
      later(stepMs * 3, () =>
        update(id, {
          status: 'PLAYABLE',
          progress: null,
          width: 1080,
          height: 1920,
          durationMs: 42_000,
          compat: 'RUNNING',
          ladder: 'QUEUED',
        }),
      )
      later(stepMs * 4, () => update(id, { compat: 'READY', ladder: 'RUNNING' }))
      later(stepMs * 5, () => update(id, { ladder: 'READY' }))
      return videos.find((v) => v.id === id)!
    },
    remove: async (id) => {
      videos = videos.filter((v) => v.id !== id)
    },
    list: async (purpose) => videos.filter((v) => v.purpose === purpose),
    playback: async () => storyGrant(),
  }

  const put: PartPut = async (target, blob, { onProgress }) => {
    onProgress(blob.size / 2)
    await new Promise((resolve) => setTimeout(resolve, putMs))
    onProgress(blob.size)
    return `"etag-${target.number}"`
  }

  return { api, put }
}
