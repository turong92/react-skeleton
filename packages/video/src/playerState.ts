import type { PlaybackKind, QualityChoice } from './playbackPlan'

/** 영상으로 보나, 소리 판(노래)으로 듣나 */
export type PlayerMode = 'video' | 'audio'

export type PlayerState = {
  phase: 'idle' | 'playing' | 'failed'
  pick: QualityChoice
  mode: PlayerMode
  /** 지금 틀고 있는 걸음(노래 모드에서는 영상으로 돌아갈 때의 걸음) */
  kind: PlaybackKind | null
  /** 이번 시도에서 해 본 걸음 */
  tried: PlaybackKind[]
  /** 시작할 시각(초) */
  at: number
  /** 붙인 뒤 바로 재생하나 - 멈춘 채 전환했으면 멈춘 채로 */
  play: boolean
  /** `<audio>` 가 이미 틀고 있다(화면이 꺼지는 순간 손짓 없이 넘긴 것) - 다시 붙이지 않는다 */
  adopt: boolean
  /** 소리 판이 실패해 영상으로 되돌아왔다 - 안내 한 줄 */
  notice: boolean
  /** 이번 시도에서 새 재생 허가를 이미 받았다 */
  refreshed: boolean
  /** 걸음이나 허가가 바뀔 때마다 오른다 - `<video>` 를 다시 붙이는 신호 */
  session: number
}

export type PlayerAction =
  | { type: 'press'; kind: PlaybackKind; mode?: PlayerMode }
  | { type: 'choose'; pick: QualityChoice; kind: PlaybackKind; at: number }
  | { type: 'next'; kind: PlaybackKind; at: number }
  | { type: 'refresh'; at: number }
  | { type: 'giveUp' }
  /** 영상 / 노래 전환 - 영상으로 돌아갈 때는 `kind` 가 필요하다. 아직 누르기 전이면 고른 모드만 기억한다 */
  | { type: 'mode'; mode: PlayerMode; kind?: PlaybackKind; at: number; play: boolean }
  /** 화면이 꺼져 같은 시각의 소리 판으로 넘겼다 */
  | { type: 'handoff'; at: number; adopt: boolean }
  /** 소리 판이 틀지 못해 같은 시각에서 영상으로 */
  | { type: 'audioFailed'; kind: PlaybackKind; at: number }

export const initialPlayer: PlayerState = {
  phase: 'idle',
  pick: 'auto',
  mode: 'video',
  kind: null,
  tried: [],
  at: 0,
  play: true,
  adopt: false,
  notice: false,
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
        mode: action.mode ?? state.mode,
        kind: action.kind,
        tried: [action.kind],
        at: 0,
        play: true,
        adopt: false,
        notice: false,
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
        play: true,
        adopt: false,
        refreshed: false,
        session,
      }
    case 'next':
      return {
        ...state,
        kind: action.kind,
        tried: [...state.tried, action.kind],
        at: action.at,
        adopt: false,
        session,
      }
    case 'refresh':
      return { ...state, at: action.at, adopt: false, refreshed: true, session }
    case 'giveUp':
      return { ...state, phase: 'failed', kind: null, tried: [], session }
    case 'mode':
      if (state.phase !== 'playing') return { ...state, mode: action.mode, notice: false }
      return {
        ...state,
        mode: action.mode,
        kind: action.kind ?? state.kind,
        tried: action.kind ? [action.kind] : state.tried,
        at: action.at,
        play: action.play,
        adopt: false,
        notice: false,
        refreshed: false,
        session,
      }
    case 'handoff':
      return {
        ...state,
        mode: 'audio',
        at: action.at,
        play: true,
        adopt: action.adopt,
        notice: false,
        refreshed: false,
        session,
      }
    case 'audioFailed':
      return {
        ...state,
        mode: 'video',
        kind: action.kind,
        tried: [action.kind],
        at: action.at,
        play: true,
        adopt: false,
        notice: true,
        refreshed: false,
        session,
      }
  }
}
