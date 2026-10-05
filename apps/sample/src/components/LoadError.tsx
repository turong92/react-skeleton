import { Button, Card } from '@skeleton/ui'
import { strings } from '../strings'
import styles from './LoadError.module.css'

/** 불러오기 실패 — 이유를 말하고 「다시 시도」를 준다(List 패턴의 오류 카드) */
export function LoadError({ onRetry, title }: { onRetry: () => void; title?: string }) {
  return (
    <Card title={title ?? strings.common.loadFailedTitle}>
      <div role="alert" className={styles.body}>
        <p>{strings.common.loadFailedBody}</p>
        <div>
          <Button variant="secondary" onClick={onRetry}>
            {strings.common.retry}
          </Button>
        </div>
      </div>
    </Card>
  )
}
