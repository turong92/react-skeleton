import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { LoadHls } from './attachSource'
import { createPlayQueue } from './createPlayQueue'
import { loadHlsLight } from './loadHls'
import { bindMediaSession } from './mediaSession'
import type { PlaybackEnv } from './playbackPlan'
import { currentOf } from './playQueue'
import { hasAudio } from './queueRouting'
import { DEFAULT_QUEUE_KEY, type QueueStorage } from './queueStorage'
import { QueueContext } from './usePlayQueue'

export type PlayQueueProviderProps = {
  children: ReactNode
  /** 이 기기에 저장하는 키 - 한 도메인에 앱이 둘이면 서로 다르게 */
  storageKey?: string
  /** 기본은 `localStorage`(없거나 막혀 있으면 저장 없이 돈다) */
  storage?: QueueStorage
  /**
   * 고른 소리 장치를 이 기기(`storage`)에 기억할 키. 안 주면 기억하지 않고 늘 기본 장치로 시작한다
   * (장치 고르기를 안 쓰는 앱은 지금과 똑같다)
   */
  outputDeviceKey?: string
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
  outputDeviceKey,
  env,
  loadHls = loadHlsLight,
}: PlayQueueProviderProps) {
  const [controller] = useState(() =>
    createPlayQueue({
      storage: storage ?? defaultStorage(),
      storageKey,
      outputDeviceKey,
      env,
      loadHls,
    }),
  )

  // 저장된 대기열은 하이드레이션 뒤에 불러온다(서버 · 첫 그림과 어긋나지 않게)
  useEffect(() => controller.restore(), [controller])

  // 소리 장치가 빠지면(블루투스가 꺼짐) 기본으로 돌아간다 - 장치를 고르게 하는 앱(`outputDeviceKey`)만 듣는다
  useEffect(
    () => (outputDeviceKey ? controller.watchOutputDevices() : undefined),
    [controller, outputDeviceKey],
  )

  // 화면이 꺼지면(`hidden`) 화면의 재생기가 필요한 곡(유튜브)은 차례가 와도 건너뛴다
  useEffect(() => {
    const onVisibility = () => controller.setVisible(document.visibilityState !== 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [controller])

  // 잠금화면 · 알림 · 이어폰의 이전/다음을 대기열에 연결한다(소리 판이 있는 곡 - 소리가 대기열 `<audio>` 라 영상을 붙여도 그대로다. 소리 판 없는 영상은 재생기가 자기 것을 묶는다)
  const { queue } = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  )
  const current = currentOf(queue)
  const title = current?.title
  const poster = current?.thumb
  const bound = current !== null && hasAudio(current)
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
