import type { PlayerSource } from './playerSource'

type ItemBase = { id: string; title: string; artist?: string; thumb?: string }
/** 우리 영상 · 소리(재생기가 트는 것) */
export type MediaItem = ItemBase & { kind: 'media'; source: PlayerSource }
/** 유튜브 영상 - IFrame Player 로 영상으로만 튼다(노래 모드 · 전환 단추 없음) */
export type YoutubeItem = ItemBase & { kind: 'youtube'; videoId: string }
export type QueueItem = MediaItem | YoutubeItem

export type RepeatMode = 'off' | 'one' | 'all'

/**
 * 재생 대기열 - `order` 가 실제 재생 순서(「다음 곡」 목록이 이것을 보인다)이고 `original` 은 셔플을 끄면 돌아갈 순서다.
 * 순수한 값이라 시험하기 쉽다 - 소리 · 유튜브를 트는 배선은 `queueController` 가 맡는다
 */
export type QueueState = {
  items: Record<string, QueueItem>
  original: string[]
  order: string[]
  currentId: string | null
  repeat: RepeatMode
  shuffle: boolean
}

export const emptyQueue: QueueState = {
  items: {},
  original: [],
  order: [],
  currentId: null,
  repeat: 'off',
  shuffle: false,
}

/** 0 이상 1 미만 난수 - 시험에서는 바꿔 끼운다 */
export type Random = () => number

export type QueueAction =
  | { type: 'set'; items: QueueItem[]; startId?: string; random?: Random }
  | { type: 'add'; item: QueueItem; where: 'end' | 'next' }
  | { type: 'remove'; id: string }
  /** `to` 는 재생 순서(`order`) 안의 새 자리 */
  | { type: 'move'; id: string; to: number }
  | { type: 'current'; id: string }
  | { type: 'repeat'; repeat: RepeatMode }
  | { type: 'shuffle'; on: boolean; random?: Random }
  | { type: 'clear' }
  | { type: 'restore'; state: QueueState }

/** 현재 곡을 맨 앞에 두고 나머지를 섞는다(Fisher-Yates) */
export function shuffled(ids: readonly string[], firstId: string | null, random: Random): string[] {
  const rest = ids.filter((id) => id !== firstId)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
  }
  return firstId !== null && ids.includes(firstId) ? [firstId, ...rest] : rest
}

const without = (ids: readonly string[], id: string) => ids.filter((x) => x !== id)

function insertAfter(ids: readonly string[], afterId: string | null, id: string): string[] {
  const at = afterId === null ? -1 : ids.indexOf(afterId)
  if (at < 0) return [...ids, id]
  return [...ids.slice(0, at + 1), id, ...ids.slice(at + 1)]
}

export function reduceQueue(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'set': {
      const items: Record<string, QueueItem> = {}
      for (const item of action.items) items[item.id] ??= item
      const ids = Object.keys(items)
      const currentId =
        action.startId !== undefined && ids.includes(action.startId)
          ? action.startId
          : (ids[0] ?? null)
      const order = state.shuffle ? shuffled(ids, currentId, action.random ?? Math.random) : ids
      return { ...state, items, original: ids, order, currentId }
    }
    case 'add': {
      const { item, where } = action
      const exists = item.id in state.items
      const items = exists ? state.items : { ...state.items, [item.id]: item }
      const after = where === 'next' ? state.currentId : null
      const place = (ids: readonly string[]) => {
        const rest = without(ids, item.id)
        return where === 'next' && after !== null && after !== item.id
          ? insertAfter(rest, after, item.id)
          : [...rest, item.id]
      }
      return {
        ...state,
        items,
        original: place(state.original),
        order: place(state.order),
        currentId: state.currentId ?? item.id,
      }
    }
    case 'remove': {
      if (!(action.id in state.items)) return state
      const items = { ...state.items }
      delete items[action.id]
      const order = without(state.order, action.id)
      let currentId = state.currentId
      if (currentId === action.id) {
        const at = state.order.indexOf(action.id)
        currentId = order[at] ?? order[at - 1] ?? null
      }
      return { ...state, items, original: without(state.original, action.id), order, currentId }
    }
    case 'move': {
      if (!state.order.includes(action.id)) return state
      const rest = without(state.order, action.id)
      const to = Math.max(0, Math.min(action.to, rest.length))
      const order = [...rest.slice(0, to), action.id, ...rest.slice(to)]
      return { ...state, order, original: state.shuffle ? state.original : order }
    }
    case 'current':
      return action.id in state.items ? { ...state, currentId: action.id } : state
    case 'repeat':
      return { ...state, repeat: action.repeat }
    case 'shuffle': {
      if (action.on === state.shuffle) return state
      const order = action.on
        ? shuffled(state.original, state.currentId, action.random ?? Math.random)
        : [...state.original]
      return { ...state, shuffle: action.on, order }
    }
    case 'clear':
      return { ...emptyQueue, repeat: state.repeat, shuffle: state.shuffle }
    case 'restore':
      return action.state
  }
}

export const currentOf = (state: QueueState): QueueItem | null =>
  state.currentId === null ? null : (state.items[state.currentId] ?? null)

/** 「다음 곡」 목록 - 현재 곡 뒤로 재생 순서대로 */
export function upcomingOf(state: QueueState): QueueItem[] {
  const at = state.currentId === null ? -1 : state.order.indexOf(state.currentId)
  return state.order.slice(at + 1).map((id) => state.items[id]!)
}

/**
 * 다음으로 틀 곡 - `canPlay` 가 아닌 곡(지금 틀 수 없는 유튜브 · 소리 판 없는 영상)은 건너뛴다. 한 바퀴를 넘어 돌지 않으므로
 * 건너뛸 곡뿐이면 `null` 이다(호출자가 멈춘다).
 * `auto`(끝나서 저절로 넘어감)이고 한 곡 반복이면 같은 곡, 반복이 꺼져 있으면 끝에서 `null`, 아니면 처음으로 돌아간다
 */
export function nextPlayableId(
  state: QueueState,
  canPlay: (item: QueueItem) => boolean,
  auto: boolean,
): string | null {
  const { order, items, currentId, repeat } = state
  if (auto && repeat === 'one' && currentId !== null && canPlay(items[currentId]!)) return currentId
  const at = currentId === null ? -1 : order.indexOf(currentId)
  const n = order.length
  for (let step = 1; step <= n; step++) {
    let j = at + step
    if (j >= n) {
      if (repeat === 'off') break
      j %= n
    }
    if (canPlay(items[order[j]!]!)) return order[j]!
  }
  return null
}

/**
 * 이전 곡 - 3초 넘게 들었으면 이 곡을 처음부터(음악 앱 관행), 아니면 앞 곡. 맨 앞이면 이 곡을 처음부터.
 * `restart` 면 같은 곡이니 되감기만 하면 된다
 */
export function previousPlayableId(
  state: QueueState,
  canPlay: (item: QueueItem) => boolean,
  positionSeconds: number,
): { id: string; restart: boolean } | null {
  const { order, items, currentId, repeat } = state
  if (currentId === null) return null
  if (positionSeconds > 3) return { id: currentId, restart: true }
  const at = order.indexOf(currentId)
  const n = order.length
  for (let step = 1; step < n; step++) {
    let j = at - step
    if (j < 0) {
      if (repeat !== 'all') break
      j += n
    }
    if (canPlay(items[order[j]!]!)) return { id: order[j]!, restart: false }
  }
  return { id: currentId, restart: true }
}
