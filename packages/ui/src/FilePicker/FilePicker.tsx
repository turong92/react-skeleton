import { useId, useRef, useState, type DragEvent } from 'react'
import { Button } from '../Button/Button'
import styles from './FilePicker.module.css'

export type FilePickerProps = {
  /** 구역의 이름(낭독 · 화면에 보인다) */
  title: string
  hint?: string
  /** 파일 창을 여는 버튼 글자 */
  buttonLabel: string
  /** `<input accept>` — 파일 창의 필터일 뿐, 검증은 호출하는 쪽이 한다 */
  accept?: string
  multiple?: boolean
  disabled?: boolean
  /** 업로드 중 — 버튼이 스피너를 보이고 눌리지 않는다 */
  loading?: boolean
  /** 고르거나 놓은 파일 — `multiple` 이 아니면 하나만 */
  onFiles: (files: File[]) => void
  invalid?: boolean
  /** 호출하는 쪽의 검증 · 업로드 오류 문구 */
  error?: string
}

/** 끌어다 놓기 + 버튼으로 파일 고르기 — 앱에서 날 `<input type="file">` 대신 쓴다 */
export function FilePicker({
  title,
  hint,
  buttonLabel,
  accept,
  multiple = false,
  disabled = false,
  loading = false,
  onFiles,
  invalid = false,
  error,
}: FilePickerProps) {
  const id = useId()
  const titleId = `${id}-title`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const inactive = disabled || loading

  const emit = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1))
  }
  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    if (!inactive) setDragging(true)
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (!inactive) emit(event.dataTransfer.files)
  }
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div
      role="group"
      className={styles.zone}
      aria-labelledby={titleId}
      aria-describedby={describedBy || undefined}
      data-dragging={dragging || undefined}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p id={titleId} className={styles.title}>
        {title}
      </p>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        className={styles.input}
        tabIndex={-1}
        aria-label={buttonLabel}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          emit(event.target.files)
          event.target.value = '' // 같은 파일을 다시 골라도 change 가 온다
        }}
      />
      <Button
        variant="secondary"
        disabled={disabled}
        loading={loading}
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </Button>
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
