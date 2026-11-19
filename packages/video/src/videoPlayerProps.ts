import type { LoadHls } from './attachSource'
import type { AudioHost } from './queueController'
import type { VideoPlayerLabels } from './labels'
import type { PlaybackEnv } from './playbackPlan'
import type { PlayerSource } from './playerSource'
import type { PlayerMode } from './playerState'
import type { VideoPlayback } from './types'

type Input =
  | {
      /** `api.playback(id)` 의 응답 */
      grant: VideoPlayback
      source?: undefined
      /**
       * 비공개 영상은 토큰이 끝나면 조각을 못 받는다 - 새 재생 허가(`api.playback(id)`)를 받아 오는 함수를 주면
       * 끝난 것을 알아챈 순간 새 허가로 **같은 시각에서** 이어 보인다. 공개 영상은 필요 없다
       */
      refreshGrant?: () => Promise<VideoPlayback>
    }
  | {
      grant?: undefined
      /** 서버 재생 허가 없이 같은 출처 주소를 그대로 튼다(쿠키 인증) - 만료 · 새 허가는 없다 */
      source: PlayerSource
      refreshGrant?: undefined
    }

export type VideoPlayerProps = Input & {
  labels?: VideoPlayerLabels
  className?: string
  /** 잠금화면 · 알림에 뜨는 제목 - 모듈은 영상 제목을 모르니 앱이 준다 */
  title?: string
  /** 처음 모드 - 소리 판이 있을 때만 `audio`(노래)로 시작한다 */
  initialMode?: PlayerMode
  /** 영상으로 재생 중 화면이 꺼지거나 앱을 나가면 같은 시각의 소리 판으로 넘긴다(기본 꺼짐). 대기열(`audioHost`)에 붙은 곡은 이미 소리가 대기열이라, 화면이 꺼지면 대기열이 모드를 노래로 바꿔 영상만 뗀다 */
  autoAudioWhenHidden?: boolean
  /** 끝까지 틀었다(소리 판 없는 영상) - 재생 대기열이 다음 곡으로 엮는다 */
  onEnded?: () => void
  /** 주면 잠금화면에 이전/다음 곡 단추가 뜬다(그러면 ±10초 단추는 안 뜬다) */
  onPrevious?: () => void
  onNext?: () => void
  /** 모드가 바뀔 때(전환 · 자동 전환 · 소리 판 실패로 영상 복귀) - 같은 값은 다시 부르지 않는다 */
  onModeChange?: (mode: PlayerMode) => void
  /** 사용자가 틀고 멈출 때(값이 바뀔 때만) - 화면을 꺼 자동 전환이 소리로 이어받으면 멈춤으로 세지 않는다 */
  onPlayingChange?: (playing: boolean) => void
  /** 영상을 틀지 못해 모든 걸음이 실패했다(소리 판 없는 영상) - 대기열이 다음 곡으로 간다 */
  onFailed?: () => void
  /** 대기열이 이 곡을 영상으로 틀라고 한다(`autoStart`) - `startSignal` 이 바뀔 때마다(다음 곡 · 한 곡 반복 · 다시 틀기) 처음부터 튼다. 브라우저가 손짓 없는 재생을 막으면 재생 단추가 남는다 */
  autoStart?: boolean
  startSignal?: number
  /** 소리 판 없는 영상에서 대기열의 재생 상태 - 미니 플레이어 · 잠금화면의 재생/일시정지에 영상이 따라간다(소리 판 있는 곡은 영상이 소리를 따라간다) */
  followPlaying?: boolean
  /** 대기열에 붙는다(`usePlayQueue().playerProps` 로 펼친다) - 소리 판이 있는 곡의 소리는 늘 대기열의 `<audio>` 가 내서 이 재생기가 사라져도 이어지고 끝나면 대기열이 다음 곡을 튼다. 이 재생기는 그 위에 음소거 영상만 붙인다 */
  audioHost?: AudioHost
  /** 영상의 기본 조작줄(`<video controls>`) - 앱이 자기 조작줄을 그릴 때 끈다(기본 켬). 끄면 무대 위 전체 화면 칩 · 화질 칩도 숨는다(앱 조작줄의 `toggleFullscreen` · `setQuality` 를 쓴다) */
  controls?: boolean
  /** 「영상 / 노래」 알약 - 앱이 자기 조작줄에 그릴 때 끈다(기본 켬). 바꾸는 것은 대기열의 `setPreferred` 로 한다 */
  modeToggle?: boolean
  /** 대기열이 정한 지금 모드(`usePlayQueue().mode`, `playerProps` 가 채운다) - 영상이면 소리 위에 음소거 영상을 붙이고, 노래면 뗀다. 큰 화면 재생기를 가리는 표시이기도 하다(화질 · 앱 조작줄) */
  queueMode?: PlayerMode
  /** 시험 · 스토리용 - 이 기기가 무엇을 트는가(기본은 브라우저에서 읽는다) */
  env?: PlaybackEnv
  /** 시험 · 스토리용 - hls.js 불러오기(기본은 light 빌드 지연 import) */
  loadHls?: LoadHls
}
