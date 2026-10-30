import { Button } from '@skeleton/ui'
import type { ReviewPhotosSlot } from '../ReviewForm'

/**
 * 사진 칸의 데모 — 진짜 앱은 여기서 `@skeleton/storage` 의 업로더로 파일을 올리고 저장 키를 `onChange` 로 돌려준다.
 * 이 패키지는 파일이 어디 있는지 · 어떻게 올리는지 모른다.
 */
export function PhotosDemo({ photos, onChange, max, disabled }: ReviewPhotosSlot) {
  return (
    <div>
      <p>
        {photos.length} / {max}
      </p>
      <Button
        variant="secondary"
        disabled={disabled || photos.length >= max}
        onClick={() => onChange([...photos, `uploads/demo-${photos.length + 1}.jpg`])}
      >
        사진 추가
      </Button>
      <ul aria-label="올린 사진">
        {photos.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
    </div>
  )
}
