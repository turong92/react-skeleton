import { Button } from '@skeleton/ui'
import type { AuthorProfileLabels } from './labels'
import styles from './AuthorPicker.module.css'

/**
 * 이 스레드에서 쓴 프로필과 **다른 것으로 바꿀 때만** 나오는 한 줄 확인 — 문장은 `role="status"` 하나(묶음 이름으로 같은 글을 두 번 읽지 않는다).
 * 「Use ○○」 로 바꾸고, 「Keep ○○」 로 **지금 고른 프로필**(`current`)을 유지한다 — 고른 것이 없으면 「Cancel」. 닫는 규칙(Esc · 바깥 · 전제 변화)은 선택기가 쥔다.
 * `data-author-notice` 는 폼이 「확인이 떠 있어 제출을 막았다」 때 포커스를 이리로 보내는 표지다. 긴 이름은 단추 안에서 말줄임(전체는 글자 그대로 낭독된다).
 */
export function AuthorPickerNotice({
  id,
  labels,
  thread,
  next,
  current,
  onUse,
  onKeep,
}: {
  /** 문장의 id — 선택기 단추가 `aria-describedby` 로 이어 받는다 */
  id: string
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
    <div className={styles.notice} data-author-notice="">
      <p id={id} role="status">
        {labels.switchNotice(thread)}
      </p>
      <Button size="sm" variant="primary" onClick={onUse}>
        <span className={styles.ellipsis}>{labels.switchConfirm(next)}</span>
      </Button>
      <Button size="sm" variant="secondary" onClick={onKeep}>
        <span className={styles.ellipsis}>
          {current ? labels.switchKeep(current) : labels.cancel}
        </span>
      </Button>
    </div>
  )
}
