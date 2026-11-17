import type { QueueItem, QueueState } from './playQueue'

/** 대기열의 선호 모드 - 사용자가 「영상 / 노래」 로 고른 것이 곡이 바뀌어도 유지된다(유튜브 뮤직처럼) */
export type Preference = 'audio' | 'video'

export type Routing = {
  preferred: Preference
  /** 화면의 재생기(영상 · 유튜브)가 그려져 있고 화면이 보인다 */
  stageOpen: boolean
}

/** 소리 판 주소 - 우리 영상의 `source.audio`, 유튜브의 `audio`(따로 받아 둔 것). 없으면 null */
export const audioUrlOf = (item: QueueItem): string | null =>
  (item.kind === 'media' ? item.source.audio : item.audio) || null

export const hasAudio = (item: QueueItem): boolean => audioUrlOf(item) !== null

/**
 * 지금 틀 수 있나(건너뛸지).
 * 노래 선호면 소리 판이 있는 곡만 - 유튜브 · 소리 판 없는 영상은 건너뛴다.
 * 영상 선호면 소리 판이 있는 곡은 늘(화면이 꺼져 있으면 소리로), 그 밖은 화면의 재생기가 보일 때만
 */
export function canPlayNow(item: QueueItem, { preferred, stageOpen }: Routing): boolean {
  if (preferred === 'audio') return hasAudio(item)
  return hasAudio(item) || stageOpen
}

/** 이 곡을 어디서 트나 - 유튜브 · 소리 판 없는 영상은 화면의 재생기, 소리 판이 있으면 소리(영상 선호이고 화면이 보이면 영상) */
export function routeOf(item: QueueItem, { preferred, stageOpen }: Routing): 'audio' | 'video' {
  if (!hasAudio(item)) return 'video'
  if (hasAudio(item) && !(preferred === 'video' && stageOpen)) return 'audio'
  return 'video'
}

/** 대기열에서 처음 만나는 소리 판 주소 - 손짓 안에서 `<audio>` 를 깨울 때 쓴다(없으면 null) */
export function firstAudioUrl(queue: QueueState): string | null {
  for (const id of queue.order) {
    const url = audioUrlOf(queue.items[id]!)
    if (url) return url
  }
  return null
}
