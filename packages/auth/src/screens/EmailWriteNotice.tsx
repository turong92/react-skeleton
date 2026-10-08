import { Button } from '@skeleton/ui'
import type { EmailRequiredController } from '../emailRequired'
import { useEmailBeforeWrite } from '../useEmailBeforeWrite'
import styles from './EmailWriteNotice.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type EmailWriteNoticeProps = {
  controller: EmailRequiredController
  labels?: Partial<AuthLabels>
}

/**
 * 댓글 칸처럼 늘 보이는 입력 **위**에 두는 막지 않는 띠 - 「쓰기 때」 방식의 서버에서 주소가 없는 계정에게만 그려진다(그 밖에는 아무것도 그리지 않는다).
 * 입력은 그대로 쓸 수 있고, 단추를 누르면 이메일 등록 화면(쓰기용)이 열린다. 그래도 빠져나간 쓰기는 403 이 받는다.
 */
export function EmailWriteNotice({ controller, labels: given }: EmailWriteNoticeProps) {
  const { needed, ensure } = useEmailBeforeWrite(controller)
  if (!needed) return null
  const labels = mergeLabels(given)
  return (
    <div className={styles.notice}>
      <p>{labels.emailRequiredWriteNotice}</p>
      <Button variant="secondary" size="sm" onClick={() => void ensure()}>
        {labels.emailRequiredWriteNoticeAction}
      </Button>
    </div>
  )
}
