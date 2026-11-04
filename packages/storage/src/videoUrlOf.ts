import type { StoredImageVariant } from './StoredImage'

/** 변환본에 실린 영상(`alternates` 의 `video/mp4` - 움직이는 이미지의 변환 결과) 주소, 없으면 undefined - 영상 판정은 여기 한 곳이다 */
export const videoUrlOf = (variant: StoredImageVariant | null | undefined): string | undefined =>
  typeof variant === 'object'
    ? variant?.alternates?.find((a) => a.contentType === 'video/mp4')?.url
    : undefined
