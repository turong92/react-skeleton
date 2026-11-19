import { Alert, Button, Progress, Spinner } from '@skeleton/ui'
import { defaultWaitingRoomLabels, type WaitingRoomLabels } from './labels'
import type { WaitingRoomStatus } from './types'
import { useCountdown } from './useCountdown'
import styles from './WaitingScreen.module.css'

export type WaitingScreenProps = {
  /** 아직 순번표를 받는 중이면 null */
  status: WaitingRoomStatus | null
  /** 순서를 확인하다 실패했다(자동으로 다시 시도한다) */
  failed?: boolean
  /** `EXPIRED` 의 「다시 줄 서기」 */
  onRejoin?: () => void
  labels?: WaitingRoomLabels
}

function PrequeueBody({ opensAt, labels }: { opensAt: string; labels: WaitingRoomLabels }) {
  const clock = useCountdown(opensAt)
  return (
    <>
      <h2 className={styles.title}>{labels.screen.prequeueTitle}</h2>
      {clock !== null && <p className={styles.big}>{labels.screen.opensIn(clock)}</p>}
      <p className={styles.note}>{labels.screen.prequeueNote}</p>
    </>
  )
}

/** 대기 화면 - 상태마다 하나(오픈 전 카운트다운 · 내 앞에 N명 + 예상 시간 + 진행 막대 · 입장 시간 끝 · 닫힘). 문구는 `labels` */
export function WaitingScreen({
  status,
  failed = false,
  onRejoin,
  labels = defaultWaitingRoomLabels,
}: WaitingScreenProps) {
  const L = labels.screen
  return (
    <section className={styles.screen} aria-live="polite">
      {status === null && (
        <p className={styles.joining}>
          <Spinner label={L.joining} />
          <span aria-hidden="true">{L.joining}</span>
        </p>
      )}
      {status?.state === 'PREQUEUE' && <PrequeueBody opensAt={status.opensAt} labels={labels} />}
      {status?.state === 'WAITING' && (
        <>
          <h2 className={styles.title}>{L.waitingTitle}</h2>
          {status.ahead !== null && <p className={styles.big}>{L.ahead(status.ahead)}</p>}
          {status.position !== null && status.ahead !== null && status.position > 0 && (
            <Progress
              label={L.progress}
              value={1 - status.ahead / status.position}
              valueText={L.yourNumber(status.position)}
            />
          )}
          <p className={styles.note}>
            {status.estimatedWaitSeconds === null
              ? L.estimateUnknown
              : L.estimate(status.estimatedWaitSeconds)}
          </p>
        </>
      )}
      {status?.state === 'ADMITTED' && <h2 className={styles.title}>{L.admittedTitle}</h2>}
      {status?.state === 'EXPIRED' && (
        <>
          <h2 className={styles.title}>{L.expiredTitle}</h2>
          <p className={styles.note}>{L.expiredBody}</p>
          {onRejoin && <Button onClick={onRejoin}>{L.rejoin}</Button>}
        </>
      )}
      {status?.state === 'CLOSED' && (
        <>
          <h2 className={styles.title}>{L.closedTitle}</h2>
          <p className={styles.note}>{L.closedBody}</p>
        </>
      )}
      {(status?.state === 'PREQUEUE' || status?.state === 'WAITING') && (
        <p className={styles.note}>{L.keepPlace}</p>
      )}
      {failed && <Alert tone="warning">{L.retrying}</Alert>}
    </section>
  )
}
