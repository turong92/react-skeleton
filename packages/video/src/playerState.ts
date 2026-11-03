import type { PlaybackKind, QualityChoice } from './playbackPlan'

export type PlayerState = {
  phase: 'idle' | 'playing' | 'failed'
  pick: QualityChoice
  /** 지금 틀고 있는 걸음 */
  kind: PlaybackKind | null
  /** 이번 시도에서 해 본 걸음 */
  tried: PlaybackKind[]
  /** 시작할 시각(초) */
  at: number
  /** 이번 시도에서 새 재생 허가를 이미 받았다 */
  refreshed: boolean
  /** 걸음이나 허가가 바뀔 때마다 오른다 - `<video>` 를 다시 붙이는 신호 */
  session: number
}

export type PlayerAction =
  | { type: 'press'; kind: PlaybackKind }
  | { type: 'choose'; pick: QualityChoice; kind: PlaybackKind; at: number }
  | { type: 'next'; kind: PlaybackKind; at: number }
  | { type: 'refresh'; at: number }
  | { type: 'giveUp' }

export const initialPlayer: PlayerState = {
  phase: 'idle',
  pick: 'auto',
  kind: null,
  tried: [],
  at: 0,
  refreshed: false,
  session: 0,
}

export function reducePlayer(state: PlayerState, action: PlayerAction): PlayerState {
  const session = state.session + 1
  switch (action.type) {
    case 'press':
      return {
        ...state,
        phase: 'playing',
        kind: action.kind,
        tried: [action.kind],
        at: 0,
        refreshed: false,
        session,
      }
    case 'choose':
      return {
        ...state,
        phase: 'playing',
        pick: action.pick,
        kind: action.kind,
        tried: [action.kind],
        at: action.at,
        refreshed: false,
        session,
      }
    case 'next':
      return {
        ...state,
        kind: action.kind,
        tried: [...state.tried, action.kind],
        at: action.at,
        session,
      }
    case 'refresh':
      return { ...state, at: action.at, refreshed: true, session }
    case 'giveUp':
      return { ...state, phase: 'failed', kind: null, tried: [], session }
  }
}
