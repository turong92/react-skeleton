import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { currentOf, upcomingOf } from './playQueue'
import type { QueueController } from './queueController'

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
    upcoming: upcomingOf(state.queue),
    order: state.queue.order.map((id) => state.queue.items[id]!),
    repeat: state.queue.repeat,
    shuffle: state.queue.shuffle,
    playing: state.playing,
    /** `audio` = 대기열이 소리만 틀고 있다, `video` = 화면의 재생기가 튼다 */
    mode: state.mode,
    /** 사용자가 고른 영상 / 노래 - 곡이 바뀌어도 유지된다 */
    preferred: state.preferred,
    stageStart: state.stageStart,
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
