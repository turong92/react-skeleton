import { Button } from '@skeleton/ui'
import type { AuthorProfileLabels } from './labels'
import styles from './AuthorPicker.module.css'

/**
 * 이 스레드에서 쓴 닉네임과 **다른 것으로 바꿀 때만** 나오는 확인 — 묶음(`role="group"`)의 이름은 질문 문장이고, 설명(`describedBy`)은 폼이 제출을 막은 이유 문장이다
 * (낭독에서 「왜 막혔는지」가 들린다). 문장은 `role="status"` 로 나타날 때 한 번 읽힌다.
 * 문장 하나가 두 닉네임을 모두 말하고(조사에 기대지 않는다), 단추는 이름 없는 고정 글자 둘이다 — 「이대로 쓰기」 로 고른 것을 쓰고, 「되돌리기」 로 **고르기 전의 닉네임**(`current`)을 유지한다.
 * 고른 것이 없으면 되돌릴 곳이 없어 「취소」. 단추 둘은 문장 아래 한 줄이고 좁은 화면에서는 줄이 바뀐다. 닫는 규칙(Esc · 바깥 · 전제 변화)은 선택기가 쥔다.
 * `data-author-notice` 는 폼이 「확인이 떠 있어 제출을 막았다」 때 포커스를 이리로 보내는 표지다. 긴 이름은 문장 안에서 줄을 바꿔 감싼다.
 */
export function AuthorPickerNotice({
  id,
  describedBy,
  labels,
  thread,
  next,
  hasCurrent,
  onUse,
  onKeep,
}: {
  /** 문장의 id — 선택기 단추가 `aria-describedby` 로 이어 받는다 */
  id: string
  /** 폼의 칸 오류 문장 id(있을 때) — 묶음의 설명 */
  describedBy?: string
  labels: AuthorProfileLabels
  /** 이 스레드에서 쓴 닉네임의 표시(문장 속 `이름#꼬리표`) */
  thread: string
  /** 바꾸려는 닉네임의 표시 */
  next: string
  /** 지금 고른 닉네임이 있는가 — 없으면 「되돌리기」 대신 「취소」 */
  hasCurrent: boolean
  onUse: () => void
  onKeep: () => void
}) {
  return (
    <div
      className={styles.notice}
      role="group"
      aria-labelledby={id}
      aria-describedby={describedBy}
      data-author-notice=""
    >
      <p id={id} role="status" className={styles.noticeText}>
        {labels.switchNotice(thread, next)}
      </p>
      <div className={styles.noticeActions}>
        <Button size="sm" variant="primary" onClick={onUse}>
          {labels.switchConfirm}
        </Button>
        <Button size="sm" variant="secondary" onClick={onKeep}>
          {hasCurrent ? labels.switchKeep : labels.cancel}
        </Button>
      </div>
    </div>
  )
}
