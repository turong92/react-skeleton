import { Button } from '@skeleton/ui'
import type { AuthorProfileLabels } from './labels'
import styles from './AuthorPicker.module.css'

/**
 * 이 스레드에서 쓴 프로필과 **다른 것으로 바꿀 때만** 나오는 한 줄 확인 — 문장은 `role="status"` 하나(묶음 이름으로 같은 글을 두 번 읽지 않는다).
 * 「Use ○○」 로 바꾸고, 「Keep ○○」 로 **지금 고른 프로필**(`current`)을 유지한다 — 고른 것이 없으면 「Cancel」. 닫는 규칙(Esc · 바깥 · 전제 변화)은 선택기가 쥔다.
 */
export function AuthorPickerNotice({
  labels,
  thread,
  next,
  current,
  onUse,
  onKeep,
}: {
  labels: AuthorProfileLabels
  /** 이 스레드에서 쓴 프로필의 표시 */
  thread: string
  /** 바꾸려는 프로필의 표시 */
  next: string
  /** 지금 고른 프로필의 표시 — 없으면 undefined */
  current: string | undefined
  onUse: () => void
  onKeep: () => void
}) {
  return (
    <div className={styles.notice}>
      <p role="status">{labels.switchNotice(thread)}</p>
      <Button size="sm" variant="primary" onClick={onUse}>
        {labels.switchConfirm(next)}
      </Button>
      <Button size="sm" variant="secondary" onClick={onKeep}>
        {current ? labels.switchKeep(current) : labels.cancel}
      </Button>
    </div>
  )
}
