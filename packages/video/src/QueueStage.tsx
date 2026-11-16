import { useEffect } from 'react'
import { usePlayQueue } from './usePlayQueue'
import { VideoPlayer } from './VideoPlayer'
import type { VideoPlayerProps } from './videoPlayerProps'
import { YoutubeStage } from './YoutubeStage'
import type { YouTubeApi } from './youtubeApi'

export type QueueStageProps = {
  className?: string
  /** 우리 영상 재생기에 더 줄 것(문구 · `autoAudioWhenHidden` …) - `source` · `grant` 는 대기열이 정한다 */
  playerProps?: Partial<Omit<VideoPlayerProps, 'source' | 'grant' | 'refreshGrant'>>
  /** 시험 · 스토리용 */
  loadYouTubeApi?: () => Promise<YouTubeApi>
}

/**
 * 큰 화면 - 지금 곡이 우리 영상이면 `VideoPlayer`(대기열의 `<audio>` 를 빌린다), 유튜브면 IFrame 재생기를 그린다.
 * 이게 그려져 있고 화면이 보이는 동안에만 유튜브 · 소리 판 없는 영상이 차례에 건너뛰어지지 않는다
 */
export function QueueStage({ className, playerProps, loadYouTubeApi }: QueueStageProps) {
  const queue = usePlayQueue()
  const { controller } = queue
  useEffect(() => {
    controller.setStage(true)
    return () => controller.setStage(false)
  }, [controller])

  const item = queue.current
  if (!item) return null
  if (item.kind === 'youtube') {
    return (
      <YoutubeStage
        className={className}
        videoId={item.videoId}
        restart={queue.stageStart}
        playing={queue.playing && queue.mode === 'video'}
        onEnded={controller.youtubeEnded}
        onFailed={controller.youtubeFailed}
        onPlaying={controller.youtubePlaying}
        loadApi={loadYouTubeApi}
      />
    )
  }
  return (
    <VideoPlayer
      key={item.id}
      className={className}
      source={item.source}
      {...queue.playerProps}
      autoStart={queue.mode === 'video' && queue.playing}
      startSignal={queue.stageStart}
      {...playerProps}
    />
  )
}
