import { Button, Card, ErrorReference } from '@skeleton/ui'
import { useT } from '../i18n'
import styles from './LoadError.module.css'

/**
 * 불러오기 실패 — 이유를 말하고 「다시 시도」를 준다(List 패턴의 오류 카드). API 오류면 참조 번호(traceId)와 복사 버튼을 붙인다 —
 * 토스트는 사라져도 문의할 번호가 화면에 남는다.
 */
export function LoadError({
  onRetry,
  title,
  error,
}: {
  onRetry: () => void
  title?: string
  error?: unknown
}) {
  const { t } = useT()
  return (
    <Card title={title ?? t('common.loadFailedTitle')}>
      <div role="alert" className={styles.body}>
        <p>{t('common.loadFailedBody')}</p>
        <ErrorReference
          error={error}
          label={t('error.reference')}
          copyLabel={t('common.copy')}
          copiedLabel={t('common.copied')}
        />
        <div>
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
