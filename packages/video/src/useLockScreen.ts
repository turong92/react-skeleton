import { useEffect } from 'react'
import { bindMediaSession } from './mediaSession'
import type { PlayIntent } from './playIntent'
import type { Latest, MediaRefs } from './playerRuntime'

type Args = {
  playing: boolean
  title?: string
  poster?: string
  hasPrevious: boolean
  hasNext: boolean
  latest: React.RefObject<Latest>
  refs: MediaRefs
  intent: PlayIntent
}

/** 잠금화면 · 알림 · 이어폰 단추(Media Session) - 재생 중에만 묶는다 */
export function useLockScreen({
  playing,
  title,
  poster,
  hasPrevious,
  hasNext,
  latest,
  refs,
  intent,
}: Args) {
  useEffect(() => {
    if (!playing) return
    return bindMediaSession(typeof navigator === 'undefined' ? undefined : navigator.mediaSession, {
      title,
      poster: poster || undefined,
      media: () =>
        latest.current.state.mode === 'audio' ? refs.audio.current : refs.video.current,
      onPrevious: hasPrevious ? () => latest.current.onPrevious?.() : undefined,
      onNext: hasNext ? () => latest.current.onNext?.() : undefined,
      onUserPause: () => intent.userPause(),
    })
    // `latest` · `refs` · `intent` 는 늘 같은 것이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, title, poster, hasPrevious, hasNext])
}
