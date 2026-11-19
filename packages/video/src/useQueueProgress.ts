import { useContext, useSyncExternalStore } from 'react'
import { QueueContext } from './usePlayQueue'

const idle = { currentTime: 0, duration: 0 }

/**
 * 지금 곡의 시각 · 길이(초)와 옮기기. 노래(대기열 `<audio>`) · 화면 영상 · 유튜브를 가리지 않는다.
 * `usePlayQueue` 와 따로 둔 것은 시각이 초당 몇 번 바뀌어서, 거기 넣으면 대기열을 쓰는 모든 화면이 그만큼 다시 그려지기 때문이다.
 * 길이를 모르면(불러오는 중 · 라이브) `duration` 은 0, 곡이 바뀌면 0 에서 시작한다
 */
export function useQueueProgress(): {
  currentTime: number
  duration: number
  seek: (seconds: number) => void
} {
  const controller = useContext(QueueContext)
  if (!controller) throw new Error('useQueueProgress 는 PlayQueueProvider 안에서 써야 한다')
  const progress = useSyncExternalStore(
    controller.subscribeProgress,
    controller.progress,
    () => idle,
  )
  return { currentTime: progress.currentTime, duration: progress.duration, seek: controller.seek }
}
