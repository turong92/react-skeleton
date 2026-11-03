import type { HlsCtor, LoadHls } from './attachSource'

/**
 * hls.js **light** 빌드(1.7.3 고정, 이 패키지의 의존) - 누를 때 처음 불러온다(gzip 약 119KB). 영상을 안 쓰는 화면은 받지 않는다.
 * light 는 자막 · 다중 오디오 · 광고 기능이 빠진 빌드라 재생 목록 재생에는 충분하다
 */
export const loadHlsLight: LoadHls = async () => {
  // @ts-expect-error hls.js 1.7.3 은 light 하위 경로의 타입을 싣지 않는다 - 쓰는 만큼의 모양은 HlsCtor
  const mod = await import('hls.js/light')
  return mod.default as HlsCtor
}
