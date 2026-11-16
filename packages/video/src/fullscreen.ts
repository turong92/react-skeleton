/** `frame` = 재생기 틀(`requestFullscreen` - 데스크톱 · 안드로이드 · 아이패드), `video` = `<video>` 만(아이폰의 `webkitEnterFullscreen`) */
export type FullscreenKind = 'frame' | 'video'

/** 이 기기가 어느 전체 화면을 하는가 - 둘 다 되면 틀(우리 단추가 남는다), 둘 다 안 되면 단추를 안 보인다 */
export function fullscreenKindOf(
  doc: { fullscreenEnabled?: boolean },
  videoProto: { webkitEnterFullscreen?: unknown } | undefined,
): FullscreenKind | null {
  if (doc.fullscreenEnabled) return 'frame'
  if (videoProto && typeof videoProto.webkitEnterFullscreen === 'function') return 'video'
  return null
}

export function enterFullscreen(
  kind: FullscreenKind,
  frame: { requestFullscreen: () => Promise<void> } | null,
  video: object | null,
): void {
  if (kind === 'frame') frame?.requestFullscreen().catch(() => {})
  else (video as { webkitEnterFullscreen?: () => void } | null)?.webkitEnterFullscreen?.()
}
