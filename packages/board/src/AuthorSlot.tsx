import type { AuthorPicker } from './authorship'
import styles from './AuthorSlot.module.css'

/**
 * 폼 안에서 `authorPicker` 를 그리는 자리 — 보드는 선택기 안쪽을 모른다. 제출 단추 옆에 둔다.
 * 오류가 보이는 동안 선택기에 오류 문장의 id(`errorId`, 폼이 `useId` 로 만든다)를 `aria-describedby` 로 넘긴다 — 낭독기가 선택기에서 오류를 읽는다.
 */
export function AuthorSlot({
  picker,
  value,
  onChange,
  threadAuthorId,
  threadLoading,
  error,
  errorId,
  disabled,
}: {
  picker: AuthorPicker
  value: string | undefined
  onChange: (authorId: string | undefined) => void
  threadAuthorId: string | undefined
  threadLoading: boolean
  /** 칸 오류 문장(없으면 오류 없음) */
  error: string | undefined
  errorId: string
  disabled: boolean
}) {
  return (
    <div data-author-slot="" className={styles.slot}>
      {picker({
        value,
        onChange,
        threadAuthorId,
        threadLoading,
        invalid: error !== undefined,
        disabled,
        'aria-describedby': error ? errorId : undefined,
      })}
    </div>
  )
}

/** 칸 오류 문장 — 칸 옆의 다른 오류(`Field`)와 같은 모양 · `role="alert"`. 제출 줄 아래에 둔다 */
export function AuthorError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} role="alert" className={styles.error}>
      {message}
    </p>
  ) : null
}
