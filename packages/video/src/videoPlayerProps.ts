import type { LoadHls } from './attachSource'
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
  /** 영상으로 재생 중 화면이 꺼지거나 앱을 나가면 같은 시각의 소리 판으로 넘긴다(기본 꺼짐) */
  autoAudioWhenHidden?: boolean
  /** 끝까지 틀었다 - 재생 대기열이 다음 곡으로 엮는다 */
  onEnded?: () => void
  /** 주면 잠금화면에 이전/다음 곡 단추가 뜬다(그러면 ±10초 단추는 안 뜬다) */
  onPrevious?: () => void
  onNext?: () => void
  /** 모드가 바뀔 때(전환 · 자동 전환 · 소리 판 실패로 영상 복귀) - 같은 값은 다시 부르지 않는다 */
  onModeChange?: (mode: PlayerMode) => void
  /** 사용자가 틀고 멈출 때(값이 바뀔 때만) - 화면을 꺼 자동 전환이 소리로 이어받으면 멈춤으로 세지 않는다 */
  onPlayingChange?: (playing: boolean) => void
  /** 시험 · 스토리용 - 이 기기가 무엇을 트는가(기본은 브라우저에서 읽는다) */
  env?: PlaybackEnv
  /** 시험 · 스토리용 - hls.js 불러오기(기본은 light 빌드 지연 import) */
  loadHls?: LoadHls
}
