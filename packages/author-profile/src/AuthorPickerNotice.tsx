import { Button } from '@skeleton/ui'
import type { AuthorProfileLabels } from './labels'
import type { ProfileParts } from './ProfileIdentity'
import { withProfile } from './withProfile'
import styles from './AuthorPicker.module.css'

/** 단추의 낭독 이름용 — 구조(이름 · 꼬리표 칸)와 무관하게 `이름#꼬리표` 한 글자열 */
const plain = ({ name, tag }: ProfileParts) => (tag ? `${name}#${tag}` : name)

/**
 * 이 스레드에서 쓴 프로필과 **다른 것으로 바꿀 때만** 나오는 한 줄 확인 — 묶음(`role="group"`)의 이름은 질문 문장이고, 설명(`describedBy`)은 폼이 제출을 막은 이유 문장이다
 * (낭독에서 「왜 막혔는지」가 들린다). 문장은 `role="status"` 로 나타날 때 한 번 읽힌다.
 * 「Use ○○」 로 바꾸고, 「Keep ○○」 로 **지금 고른 프로필**(`current`)을 유지한다 — 고른 것이 없으면 「Cancel」. 닫는 규칙(Esc · 바깥 · 전제 변화)은 선택기가 쥔다.
 * `data-author-notice` 는 폼이 「확인이 떠 있어 제출을 막았다」 때 포커스를 이리로 보내는 표지다. 단추 안의 긴 이름은 이름만 말줄임이고 꼬리표는 고정(전체는 글자 그대로 낭독된다).
 */
export function AuthorPickerNotice({
  id,
  describedBy,
  labels,
  thread,
  next,
  current,
  onUse,
  onKeep,
}: {
  /** 문장의 id — 선택기 단추가 `aria-describedby` 로 이어 받는다 */
  id: string
  /** 폼의 칸 오류 문장 id(있을 때) — 묶음의 설명 */
  describedBy?: string
  labels: AuthorProfileLabels
  /** 이 스레드에서 쓴 프로필의 표시(문장 속) */
  thread: string
  /** 바꾸려는 프로필 */
  next: ProfileParts
  /** 지금 고른 프로필 — 없으면 undefined */
  current: ProfileParts | undefined
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
      <p id={id} role="status">
        {labels.switchNotice(thread)}
      </p>
      <Button
        size="sm"
        variant="primary"
        aria-label={labels.switchConfirm(plain(next))}
        onClick={onUse}
      >
        <span className={styles.buttonText}>{withProfile(labels.switchConfirm, next)}</span>
      </Button>
      <Button
        size="sm"
        variant="secondary"
        aria-label={current ? labels.switchKeep(plain(current)) : labels.cancel}
        onClick={onKeep}
      >
        <span className={styles.buttonText}>
          {current ? withProfile(labels.switchKeep, current) : labels.cancel}
        </span>
      </Button>
    </div>
  )
}
