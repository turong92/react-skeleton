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

/** 이 무대(또는 그 안)가 지금 전체 화면이면 나온다 - 무대가 대상에서 빠질 때(노래 모드로 자동 전환 · 사라짐) 전체 화면이 남아 상태가 틀어지지 않게 */
export function leaveFullscreenOf(
  stage: { contains: (node: never) => boolean } | null,
  doc: { fullscreenElement: unknown; exitFullscreen: () => Promise<void> },
): void {
  if (stage && doc.fullscreenElement && stage.contains(doc.fullscreenElement as never))
    doc.exitFullscreen().catch(() => {})
}

export function toggleFullscreen(
  kind: FullscreenKind,
  frame: { requestFullscreen: () => Promise<void> } | null,
  video: object | null,
  doc: { fullscreenElement: unknown; exitFullscreen: () => Promise<void> },
): void {
  if (kind === 'frame') {
    const request = doc.fullscreenElement ? doc.exitFullscreen() : frame?.requestFullscreen()
    request?.catch(() => {})
  } else (video as { webkitEnterFullscreen?: () => void } | null)?.webkitEnterFullscreen?.()
}
