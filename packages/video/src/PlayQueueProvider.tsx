import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { LoadHls } from './attachSource'
import { createPlayQueue } from './createPlayQueue'
import { loadHlsLight } from './loadHls'
import { bindMediaSession } from './mediaSession'
import type { PlaybackEnv } from './playbackPlan'
import { currentOf } from './playQueue'
import { DEFAULT_QUEUE_KEY, type QueueStorage } from './queueStorage'
import { QueueContext } from './usePlayQueue'

export type PlayQueueProviderProps = {
  children: ReactNode
  /** 이 기기에 저장하는 키 - 한 도메인에 앱이 둘이면 서로 다르게 */
  storageKey?: string
  /** 기본은 `localStorage`(없거나 막혀 있으면 저장 없이 돈다) */
  storage?: QueueStorage
  /** 시험 · 스토리용 */
  env?: PlaybackEnv
  loadHls?: LoadHls
}

function defaultStorage(): QueueStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/**
 * 재생 대기열 - **앱 최상단**에 둔다(라우트를 옮겨도 소리가 이어지고 작은 재생기가 남는다). `<audio>` 하나를 쥐고 곡마다 다시 쓰므로
 * 화면이 꺼진 채로도 다음 곡으로 넘어간다. 상태는 이 기기에 저장되어 새로 고침 뒤에 복원된다(저절로 틀지는 않는다)
 */
export function PlayQueueProvider({
  children,
  storageKey = DEFAULT_QUEUE_KEY,
  storage,
  env,
  loadHls = loadHlsLight,
}: PlayQueueProviderProps) {
  const [controller] = useState(() =>
    createPlayQueue({ storage: storage ?? defaultStorage(), storageKey, env, loadHls }),
  )

  // 저장된 대기열은 하이드레이션 뒤에 불러온다(서버 · 첫 그림과 어긋나지 않게)
  useEffect(() => controller.restore(), [controller])

  // 화면이 꺼지면(`hidden`) 화면의 재생기가 필요한 곡(유튜브)은 차례가 와도 건너뛴다
  useEffect(() => {
    const onVisibility = () => controller.setVisible(document.visibilityState !== 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [controller])

  // 잠금화면 · 알림 · 이어폰의 이전/다음을 대기열에 연결한다(소리 모드일 때 - 영상 모드는 재생기가 자기 것을 묶는다)
  const { queue, mode } = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  )
  const current = currentOf(queue)
  const title = current?.title
  const poster = current?.thumb
  const bound = current !== null && mode === 'audio'
  useEffect(() => {
    if (!bound) return
    return bindMediaSession(typeof navigator === 'undefined' ? undefined : navigator.mediaSession, {
      title,
      poster,
      media: () => controller.host.element(),
      onPrevious: () => controller.previous(),
      onNext: () => controller.next(),
    })
  }, [bound, title, poster, controller])

  const attachAudio = useCallback(
    (element: HTMLAudioElement | null) => controller.attachElement(element),
    [controller],
  )

  return (
    <QueueContext value={controller}>
      {children}
      <audio ref={attachAudio} preload="none" hidden />
    </QueueContext>
  )
}
