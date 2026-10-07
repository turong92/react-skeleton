import type { AuthorPicker } from './authorship'
import styles from './AuthorSlot.module.css'

/** 폼 안에서 `authorPicker` 를 그리는 자리 — 보드는 선택기 안쪽을 모른다. 제출 단추 옆에 둔다 */
export function AuthorSlot({
  picker,
  value,
  onChange,
  threadAuthorId,
  invalid,
  disabled,
}: {
  picker: AuthorPicker
  value: string | undefined
  onChange: (authorId: string | undefined) => void
  threadAuthorId: string | undefined
  invalid: boolean
  disabled: boolean
}) {
  return (
    <div data-author-slot="" className={styles.slot}>
      {picker({ value, onChange, threadAuthorId, invalid, disabled })}
    </div>
  )
}

/** 칸 오류 문장 — 칸 옆의 다른 오류(`Field`)와 같은 모양 · `role="alert"` */
export function AuthorError({ message }: { message: string | undefined }) {
  return message ? (
    <p role="alert" className={styles.error}>
      {message}
    </p>
  ) : null
}
