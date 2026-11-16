import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { readCanSetVolume } from './mediaOutput'
import { currentOf, upcomingOf } from './playQueue'
import type { QueueController } from './queueController'

const subscribeNothing = () => () => {}
const serverFalse = () => false

export const QueueContext = createContext<QueueController | null>(null)

/**
 * 대기열 읽기 + 조작. `playerProps` 를 `VideoPlayer` 에 펼쳐 주면 그 재생기가 대기열의 `<audio>` 를 빌려 쓰고(노래 모드 · 화면이 꺼질 때의
 * 자동 전환이 대기열에 이어진다) 끝나면 다음 곡, 잠금화면 이전/다음이 대기열로 간다
 */
export function usePlayQueue() {
  const controller = useContext(QueueContext)
  if (!controller) throw new Error('usePlayQueue 는 PlayQueueProvider 안에서 써야 한다')
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const current = currentOf(state.queue)
  // 지금 곡이 노래 모드가 되나 - 서버 · 하이드레이션 첫 그림은 false(기기를 모른다)
  const canAudio = useSyncExternalStore(subscribeNothing, controller.canAudio, serverFalse)
  // 이 기기가 코드로 음량을 바꿀 수 있나 - 서버 · 하이드레이션 첫 그림은 false, 브라우저가 재서 알려 준다
  const canSetVolume = useSyncExternalStore(subscribeNothing, readCanSetVolume, serverFalse)
  const playerProps = useMemo(
    () => ({
      audioHost: controller.host,
      title: current?.title,
      onEnded: controller.videoEnded,
      onPrevious: controller.previous,
      onNext: controller.next,
      onPlayingChange: controller.setVideoPlaying,
      onFailed: controller.videoFailed,
    }),
    [controller, current?.title],
  )
  return {
    current,
    /** 재생 순서(`order`) 안 지금 곡의 순번 - 없으면 -1 */
    currentIndex:
      state.queue.currentId === null ? -1 : state.queue.order.indexOf(state.queue.currentId),
    upcoming: upcomingOf(state.queue),
    order: state.queue.order.map((id) => state.queue.items[id]!),
    repeat: state.queue.repeat,
    shuffle: state.queue.shuffle,
    playing: state.playing,
    /** `audio` = 대기열이 소리만 틀고 있다, `video` = 화면의 재생기가 튼다 */
    mode: state.mode,
    /** 사용자가 고른 영상 / 노래 - 곡이 바뀌어도 유지된다 */
    preferred: state.preferred,
    /** 음량 0~1 · 음소거 - 대기열 `<audio>` · 화면 영상 · 유튜브에 같이 걸린다(이 기기에 저장) */
    volume: state.volume,
    muted: state.muted,
    /** 이 기기가 코드로 음량을 바꿀 수 있나 - 아이폰은 기기 단추뿐이라 false(음량 칸을 숨긴다). 서버에서는 false */
    canSetVolume,
    /** 지금 곡을 노래(소리만)로 틀 수 있나(소리 판이 있고 이 기기가 틀 수 있다 · 유튜브는 false) - 앱의 「영상 / 노래」 알약을 보일지 정한다. 바꾸는 것은 `setPreferred` */
    canAudio,
    /** 큰 화면이 지금 전체 화면인가 · 전체 화면으로 할 수 있나(노래 모드 · 아이폰의 유튜브는 false) · 켜고 끄기 */
    fullscreen: state.fullscreen,
    canFullscreen: state.canFullscreen,
    toggleFullscreen: controller.toggleFullscreen,
    setVolume: controller.setVolume,
    setMuted: controller.setMuted,
    stageStart: state.stageStart,
    preferSignal: state.preferSignal,
    audioStart: state.audioStart,
    playerProps,
    controller,
    setQueue: controller.setQueue,
    add: controller.add,
    remove: controller.remove,
    move: controller.move,
    clear: controller.clear,
    setPreferred: controller.setPreferred,
    setRepeat: controller.setRepeat,
    setShuffle: controller.setShuffle,
    play: controller.play,
    pause: controller.pause,
    resume: controller.resume,
    toggle: controller.toggle,
    next: controller.next,
    previous: controller.previous,
  }
}
