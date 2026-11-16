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

export function momentOf(
  media: { readyState: number; currentTime: number } | null,
  known: number,
): number {
  return media && media.readyState > 0 ? media.currentTime : known
}

/**
 * 이 재생기가 앱 조작줄에 화질을 내줄 때 - 영상이 보이는 동안은 어디에 그려졌든, 멈춘 채 · 시작 전에는 **큰 화면 재생기**(`QueueStage` 가 대기열의
 * 선호 `preferredMode` 를 넘긴다)가 영상 모드로 정해져 있을 때만. 큰 화면 밖에 그려진 재생기가 앱 조작줄을 엉뚱한 영상에 붙이지 않게 한다
 */
export function qualityChoosable(input: {
  showVideo: boolean
  mode: PlayerMode
  preferredMode: PlayerMode | undefined
  options: number
}): boolean {
  const bigScreenIdle =
    input.preferredMode !== undefined && input.mode === 'video' && input.preferredMode !== 'audio'
  return (input.showVideo || bigScreenIdle) && input.options > 1
}

/** 대기열이 선호를 (다시) 정했다는 신호가 왔을 때 재생기가 옮겨 갈 모드 - 선호가 없거나 이미 그 모드면 null(값이 그대로여도 신호는 온다: 화면 꺼짐 자동 전환 뒤에는 선호 ≠ 지금 모드) */
export function followPreference(
  preferred: PlayerMode | undefined,
  current: PlayerMode,
): PlayerMode | null {
  return preferred === undefined || preferred === current ? null : preferred
}

/** 영상 요소를 대기열의 재생 상태(`want`)에 맞출 때 할 일 - 이미 같으면 null */
export function followPlayback(
  paused: boolean,
  want: boolean | undefined,
): 'play' | 'pause' | null {
  if (want === undefined) return null
  if (want && paused) return 'play'
  if (!want && !paused) return 'pause'
  return null
}

export type PlayerAction =
  | { type: 'press'; kind: PlaybackKind; mode?: PlayerMode }
  | { type: 'choose'; pick: QualityChoice; kind: PlaybackKind; at: number; play?: boolean }
  /** 아직 틀기 전(또는 실패 뒤)에 화질만 고른다 - 첫 재생의 첫 걸음이 이것이 된다 */
  | { type: 'pick'; pick: QualityChoice }
  | { type: 'next'; kind: PlaybackKind; at: number }
  | { type: 'refresh'; at: number }
  | { type: 'giveUp' }
  /** 영상 / 노래 전환 - 영상으로 돌아갈 때는 `kind` 가 필요하다. 아직 누르기 전이면 고른 모드만 기억한다 */
  | { type: 'mode'; mode: PlayerMode; kind?: PlaybackKind; at: number; play: boolean }
  /** 화면이 꺼져 같은 시각의 소리 판으로 넘겼다 */
  | { type: 'handoff'; at: number; adopt: boolean }
  /** 소리 판이 틀지 못해 같은 시각에서 영상으로 */
  | { type: 'audioFailed'; kind: PlaybackKind; at: number; play: boolean }
  /** 넘긴 `<audio>` 를 폰이 틀지 못했다 - 노래 모드는 그대로 멈춘 채 */
  | { type: 'paused' }
  /** 대기열이 이 곡을 소리로 틀기 시작했다 - 이미 그려진 재생기가 처음부터 틀지 않고 이어받는다 */
  | { type: 'join'; at: number; play: boolean }

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
    case 'pick':
      return { ...state, pick: action.pick }
    case 'choose':
      return {
        ...state,
        phase: 'playing',
        pick: action.pick,
        kind: action.kind,
        tried: [action.kind],
        at: action.at,
        play: action.play ?? true,
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
        play: action.play,
        adopt: false,
        notice: true,
        refreshed: false,
        session,
      }
    case 'paused':
      return { ...state, play: false }
    case 'join':
      return {
        ...state,
        phase: 'playing',
        mode: 'audio',
        at: action.at,
        play: action.play,
        adopt: true,
        notice: false,
        refreshed: false,
        session,
      }
  }
}
