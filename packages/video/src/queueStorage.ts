import { emptyQueue, type QueueItem, type QueueState, type RepeatMode } from './playQueue'

/** 앱이 바꿀 수 있는 저장 키의 기본값 */
export const DEFAULT_QUEUE_KEY = 'skeleton.playQueue'

/** `localStorage` 가 하는 만큼 - 시험에서는 바꿔 끼운다 */
export type QueueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const VERSION = 1
const REPEATS: readonly RepeatMode[] = ['off', 'one', 'all']

const isString = (v: unknown): v is string => typeof v === 'string'

function isItem(value: unknown): value is QueueItem {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!isString(v.id) || !isString(v.title)) return false
  if (v.kind === 'youtube') return isString(v.videoId)
  if (v.kind !== 'media') return false
  const source = v.source as Record<string, unknown> | undefined
  return typeof source === 'object' && source !== null && isString(source.src)
}

/** 저장된 글자를 대기열로 - 모양이 어긋나면(손으로 고친 값 · 옛 모양) 버리고 빈 대기열 */
export function parseQueue(text: string | null): QueueState {
  if (!text) return emptyQueue
  try {
    const raw = JSON.parse(text) as Record<string, unknown>
    if (raw.v !== VERSION || !Array.isArray(raw.items)) return emptyQueue
    const items: Record<string, QueueItem> = {}
    for (const item of raw.items) if (isItem(item)) items[item.id] ??= item
    const known = (ids: unknown) =>
      Array.isArray(ids)
        ? [...new Set(ids.filter((id): id is string => isString(id) && id in items))]
        : []
    const original = known(raw.original)
    const order = known(raw.order)
    // 순서 목록이 빠진 곡은 끝에 붙이고, 목록에만 있는 곡은 버린다
    for (const id of Object.keys(items)) {
      if (!original.includes(id)) original.push(id)
      if (!order.includes(id)) order.push(id)
    }
    const currentId =
      isString(raw.currentId) && raw.currentId in items ? raw.currentId : (order[0] ?? null)
    return {
      items,
      original,
      order,
      currentId,
      repeat: REPEATS.includes(raw.repeat as RepeatMode) ? (raw.repeat as RepeatMode) : 'off',
      shuffle: raw.shuffle === true,
    }
  } catch {
    return emptyQueue
  }
}

export function serializeQueue(state: QueueState): string {
  return JSON.stringify({
    v: VERSION,
    items: state.order.map((id) => state.items[id]),
    original: state.original,
    order: state.order,
    currentId: state.currentId,
    repeat: state.repeat,
    shuffle: state.shuffle,
  })
}

export type StoredVolume = { volume: number; muted: boolean }

/** 음량 · 음소거는 대기열과 따로(`<키>.volume`) 둔다 - 대기열을 비워도 기억되고, 옛 대기열 저장값은 그대로 읽힌다 */
export function loadVolume(storage: QueueStorage | undefined, key: string): StoredVolume {
  try {
    const raw = JSON.parse(storage?.getItem(`${key}.volume`) ?? 'null') as Record<
      string,
      unknown
    > | null
    const volume = raw?.volume
    return {
      volume: typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : 1,
      muted: raw?.muted === true,
    }
  } catch {
    return { volume: 1, muted: false }
  }
}

export function saveVolume(
  storage: QueueStorage | undefined,
  key: string,
  value: StoredVolume,
): void {
  try {
    storage?.setItem(`${key}.volume`, JSON.stringify(value))
  } catch {
    // 저장 실패는 삼킨다
  }
}

export function loadQueue(storage: QueueStorage | undefined, key: string): QueueState {
  try {
    return parseQueue(storage?.getItem(key) ?? null)
  } catch {
    return emptyQueue
  }
}

/** 비면 키를 지운다. 저장이 막혀 있어도(사생활 보호 · 용량) 재생은 계속된다 */
export function saveQueue(storage: QueueStorage | undefined, key: string, state: QueueState): void {
  try {
    if (state.order.length === 0) storage?.removeItem(key)
    else storage?.setItem(key, serializeQueue(state))
  } catch {
    // 저장 실패는 삼킨다
  }
}
