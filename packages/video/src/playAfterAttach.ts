type PlayableMedia = Pick<
  HTMLMediaElement,
  'play' | 'paused' | 'addEventListener' | 'removeEventListener'
>

/**
 * 붙인 직후의 `play()` - hls.js 는 스트림을 붙이며 요소를 다시 불러 먼저 건 `play()` 가 `AbortError` 로 끊긴다(거절이 아니다).
 * 그걸 「틀 수 없다」로 보고하면 대기열이 멈춘 것으로 알아 영상이 도로 멈춘다 - 그래서 `AbortError` 는 무시하고, hls.js 면 메타데이터가 오는 때
 * 아직 원하고(취소 안 됨) 멈춰 있으면 한 번 더 건다. 진짜 거절(손짓 없는 자동 재생 차단)만 `onRejected` 로 알린다. 돌려받은 함수가 기다림을 취소한다
 */
export function playAfterAttach(
  media: PlayableMedia,
  engine: 'native' | 'hlsjs',
  onRejected: () => void,
): () => void {
  let wanted = true
  const play = () =>
    void media.play()?.catch((error: unknown) => {
      if ((error as { name?: string } | null)?.name !== 'AbortError') onRejected()
    })
  const again = () => {
    if (wanted && media.paused) play()
  }
  play()
  if (engine === 'hlsjs') media.addEventListener('loadedmetadata', again, { once: true })
  return () => {
    wanted = false
    media.removeEventListener('loadedmetadata', again)
  }
}
