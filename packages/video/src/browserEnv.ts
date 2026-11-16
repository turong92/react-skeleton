import { fullscreenKindOf } from './fullscreen'
import { HLS_MIME, nativeHlsIsReliable, type PlaybackEnv } from './playbackPlan'

let browserEnv: PlaybackEnv | undefined

/** 이 기기가 무엇을 트는가 - 브라우저에서 한 번만 읽는다(서버에서는 모른다) */
export function readBrowserEnv(): PlaybackEnv {
  if (browserEnv) return browserEnv
  const probe = document.createElement('video')
  const w = window as unknown as Record<string, { isTypeSupported?: (type: string) => boolean }>
  const mse = w.MediaSource ?? w.ManagedMediaSource
  const brands = (
    navigator as { userAgentData?: { brands?: Array<{ brand: string }> } }
  ).userAgentData?.brands?.map((entry) => entry.brand)
  const hlsReliable = nativeHlsIsReliable(navigator.userAgent, brands)
  browserEnv = {
    canPlayType: (mime) =>
      typeof probe.canPlayType === 'function' &&
      (hlsReliable || mime !== HLS_MIME) &&
      Boolean(probe.canPlayType(mime)),
    mse:
      mse && typeof mse.isTypeSupported === 'function'
        ? { isTypeSupported: (t) => mse.isTypeSupported!(t) }
        : null,
    fullscreen: fullscreenKindOf(
      document,
      (window as unknown as { HTMLVideoElement?: { prototype: object } }).HTMLVideoElement
        ?.prototype,
    ),
  }
  return browserEnv
}
