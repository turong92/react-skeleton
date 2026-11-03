import type { ImageVariant } from './storageApi'
import styles from './StoredImage.module.css'

/** 변환본 하나 — 주소 글자(게시판 `attachmentImages`) 또는 `{ url, width?, height? }`(`api.images`) */
export type StoredImageVariant = string | ImageVariant

/** 서버 모양 — `api.images` 의 줄 · 게시판 `attachmentImages` 의 값이 그대로 들어온다 */
export type StoredImageSource = {
  /** 원본(회전 반영) 크기 — 자리를 미리 잡아 화면이 밀리지 않게 한다 */
  width?: number | null
  height?: number | null
  thumb?: StoredImageVariant | null
  display?: StoredImageVariant | null
  /** 같은 그림의 다른 형식(`{ 'image/webp': { thumb, display } }`) — 있으면 `<picture>` 로 그리고 `thumb`/`display` 는 폴백이 된다 */
  alternates?: Record<
    string,
    { thumb?: StoredImageVariant | null; display?: StoredImageVariant | null }
  >
}

export type StoredImageProps = {
  image: StoredImageSource
  alt: string
  /** `<img sizes>` — 화면에서 차지하는 폭(`srcset` 이 있을 때만 뜻이 있다) */
  sizes?: string
  className?: string
}

/** 서버 모듈 기본 변환본 폭 — 주소 글자만 받았을 때 `srcset` 의 폭으로 본다(`thumb` 400 · `display` 1600) */
const DEFAULT_WIDTH = { thumb: 400, display: 1600 } as const

/** 변환본이 영상(`video/mp4` - 움직이는 이미지의 변환 결과)인지 - 영상 판정은 여기 한 곳이다 */
export const isVideoVariant = (variant: StoredImageVariant | null | undefined): boolean =>
  typeof variant === 'object' && variant?.contentType === 'video/mp4'

const parts = (variant: StoredImageVariant | null | undefined) =>
  typeof variant === 'string' ? { url: variant } : variant

/**
 * 저장된 이미지를 반응형으로 그린다(`display.contentType` 이 `video/mp4` 면 소리 없는 반복 `<video>`) — `src` 는 `display`(없으면 `thumb`), 둘 다 있으면 `srcset="thumb 400w, display 1600w"`.
 * `alternates`(WebP 등)가 있으면 `<picture><source type srcset>` 뒤에 `<img>` 폴백. 폭 · 높이를 알면 속성으로 둬 이미지가 오기 전에 자리가 잡히고, `loading="lazy"` · `decoding="async"`.
 */
export function StoredImage({ image, alt, sizes, className }: StoredImageProps) {
  const main = parts(image.display) ?? parts(image.thumb)
  if (!main) return null
  const classes = [styles.image, className].filter(Boolean).join(' ')
  if (isVideoVariant(image.display)) {
    // 움직이는 이미지의 변환본 - 소리 없이 반복 재생해 GIF 처럼 보인다
    return (
      <video
        className={classes}
        src={main.url}
        poster={parts(image.thumb)?.url}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        aria-label={alt}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
    )
  }
  const srcSetOf = (source: Pick<StoredImageSource, 'thumb' | 'display'>) => {
    const thumb = parts(source.thumb)
    const display = parts(source.display)
    // 변환본은 긴 변을 상자(400 · 1600)에 맞추고 키우지 않는다 - 세로 사진의 폭은 상자보다 작다
    const width = (variant: ImageVariant | undefined, name: keyof typeof DEFAULT_WIDTH) => {
      if (variant?.width) return variant.width
      const box = DEFAULT_WIDTH[name]
      if (!image.width || !image.height) return box
      return Math.round(image.width * Math.min(1, box / Math.max(image.width, image.height)))
    }
    return thumb && display
      ? `${thumb.url} ${width(thumb, 'thumb')}w, ${display.url} ${width(display, 'display')}w`
      : undefined
  }
  const srcSet = srcSetOf(image)
  const img = (
    <img
      className={classes}
      src={main.url}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  )
  const sources = Object.entries(image.alternates ?? {}).flatMap(([type, alternate]) => {
    const set = srcSetOf(alternate) ?? parts(alternate.display ?? alternate.thumb)?.url
    return set ? [<source key={type} type={type} srcSet={set} sizes={sizes} />] : []
  })
  return sources.length > 0 ? (
    <picture>
      {sources}
      {img}
    </picture>
  ) : (
    img
  )
}
