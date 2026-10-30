import { Button, Field, Textarea } from '@skeleton/ui'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { ReviewsLabels } from './labels'
import { RatingInput } from './RatingInput'
import type { Rating, ReviewConfig, ReviewInput } from './types'
import { validateReview, type ReviewProblems } from './validateReview'
import styles from './ReviewForm.module.css'

/** `renderPhotos` 가 받는 것 — 올리기 · 지우기는 앱이 `@skeleton/storage` 로 잇고, 폼은 저장 키 목록만 쥔다 */
export type ReviewPhotosSlot = {
  /** 지금 붙은 저장 키들 */
  photos: string[]
  onChange: (photos: string[]) => void
  /** 서버가 허용하는 최대 장수(`config.maxPhotos`) */
  max: number
  disabled: boolean
}

export type ReviewFormProps = {
  config: Pick<ReviewConfig, 'bodyMinLength' | 'bodyMaxLength' | 'maxPhotos'>
  labels: ReviewsLabels
  /** 고칠 때의 처음 값. 있으면 「수정 저장」 단추 */
  initial?: { rating: Rating; body: string }
  /**
   * 보내는 일 — 약속이 풀리면 끝이고, 던지면(서버 오류) 쓴 글을 그대로 둔다. 오류 표시는 앱의 전역 핸들러.
   * `photos` 는 사진 칸을 만졌을 때만 실린다(서버 응답에는 저장 키가 없어서 고칠 때 처음 값을 알 수 없다 - 안 만지면 그대로)
   */
  onSubmit: (input: ReviewInput) => Promise<unknown> | void
  /** 있으면 취소 단추가 생긴다 */
  onCancel?: () => void
  /** 사진 칸. 안 주면(또는 `maxPhotos` 가 0) 자리를 그리지 않는다 - 패키지는 storage 를 모른다 */
  renderPhotos?: (slot: ReviewPhotosSlot) => ReactNode
}

/** 리뷰 쓰기 · 고치기 폼 — 별점(필수) + 본문(길이 한도) + 앱이 꽂는 사진 칸 */
export function ReviewForm({
  config,
  labels,
  initial,
  onSubmit,
  onCancel,
  renderPhotos,
}: ReviewFormProps) {
  const t = labels.form
  const ratingErrorId = useId()
  const [rating, setRating] = useState<Rating | null>(initial?.rating ?? null)
  const [body, setBody] = useState(initial?.body ?? '')
  const [photos, setPhotos] = useState<string[]>([])
  const [photosTouched, setPhotosTouched] = useState(false)
  const [problems, setProblems] = useState<ReviewProblems>({})
  const [pending, setPending] = useState(false)
  const withPhotos = renderPhotos !== undefined && config.maxPhotos > 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = validateReview({ rating, body }, config, t)
    setProblems(found)
    if (found.rating) {
      form.querySelector<HTMLElement>('input[type="radio"]')?.focus()
      return
    }
    if (found.body || rating === null) {
      ;(form.elements.namedItem('body') as HTMLElement | null)?.focus()
      return
    }
    setPending(true)
    try {
      await onSubmit({ rating, body: body.trim(), ...(photosTouched ? { photos } : {}) })
    } catch {
      // 쓴 글은 그대로 - 오류 토스트는 전역 핸들러가 띄운다
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <div className={styles.rating}>
        <RatingInput
          value={rating}
          onChange={(next) => {
            setRating(next)
            setProblems((p) => ({ ...p, rating: undefined }))
          }}
          labels={labels}
          legend={t.rating}
          invalid={Boolean(problems.rating)}
          describedBy={problems.rating ? ratingErrorId : undefined}
          disabled={pending}
        />
        {problems.rating && (
          <p id={ratingErrorId} role="alert" className={styles.error}>
            {problems.rating}
          </p>
        )}
      </div>
      <Field
        label={t.body}
        hint={t.bodyHint(config.bodyMinLength, config.bodyMaxLength)}
        error={problems.body}
      >
        {(control) => (
          <Textarea
            {...control}
            name="body"
            rows={5}
            value={body}
            disabled={pending}
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </Field>
      {withPhotos && (
        <div className={styles.photos}>
          {renderPhotos({
            photos,
            max: config.maxPhotos,
            disabled: pending,
            onChange: (next) => {
              setPhotos(next)
              setPhotosTouched(true)
            },
          })}
        </div>
      )}
      <div className={styles.actions}>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {t.cancel}
          </Button>
        )}
        <Button type="submit" loading={pending} loadingLabel={t.sending}>
          {initial ? t.save : t.submit}
        </Button>
      </div>
    </form>
  )
}
