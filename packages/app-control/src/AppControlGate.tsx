import { Alert, Button } from '@skeleton/ui'
import { useState, type ReactNode } from 'react'
import type { AppControlApi } from './appControlApi'
import styles from './AppControlGate.module.css'
import { appStateOf } from './gate'
import { useAppConfig } from './hooks'
import { mergeAppControlLabels, type AppControlLabels } from './labels'

export type AppControlGateProps = {
  api: AppControlApi
  /** 이 앱의 버전(빌드 때 넣는 상수). 없으면 버전으로 막지 않는다 */
  appVersion?: string
  /** 서버 `platforms` 의 키(기본 `web`) */
  platform?: string
  /** 업데이트 버튼의 동작 — 기본은 페이지 새로고침(웹은 새 배포를 받는 길이 새로고침이다) */
  onUpdate?: () => void
  /** 점검 끝 예정 시각(ISO)을 읽기 좋게 — 기본은 브라우저의 지역 형식 */
  formatTime?: (iso: string) => string
  labels?: Partial<AppControlLabels>
  children: ReactNode
}

const localTime = (iso: string) => new Date(iso).toLocaleString()
const reload = () => window.location.reload()

/**
 * 앱 맨 위에 둔다 — 점검 중이면 점검 화면, 최소 버전 미만이면 닫을 수 없는 새로고침 화면, 권장 버전 미만이면 위에 닫을 수 있는 띠를 얹고 아니면 `children` 그대로.
 * 설정을 못 읽으면 막지 않는다. 판정 규칙은 `appStateOf`(순수 함수)에 있다.
 */
export function AppControlGate({
  api,
  appVersion,
  platform,
  onUpdate = reload,
  formatTime = localTime,
  labels,
  children,
}: AppControlGateProps) {
  const L = mergeAppControlLabels(labels)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const { data } = useAppConfig(api)
  const state = appStateOf(data, { appVersion, platform, dismissed })

  if (state.kind === 'maintenance') {
    return (
      <section className={styles.screen} role="status" aria-live="polite">
        <h1 className={styles.title}>{L.maintenanceTitle}</h1>
        <p className={styles.body}>{state.message ?? L.maintenanceBody}</p>
        {state.endsAt && (
          <p className={styles.note}>{L.maintenanceEnds(formatTime(state.endsAt))}</p>
        )}
      </section>
    )
  }
  if (state.kind === 'update-required') {
    return (
      <section className={styles.screen} role="alert">
        <h1 className={styles.title}>{L.updateRequiredTitle}</h1>
        <p className={styles.body}>{L.updateRequiredBody}</p>
        <Button onClick={onUpdate}>{L.updateAction}</Button>
      </section>
    )
  }
  return (
    <>
      {state.kind === 'update-recommended' && (
        <Alert
          tone="info"
          title={L.updateRecommendedTitle}
          dismissLabel={L.later}
          onDismiss={() => setDismissed(state.recommendedVersion)}
          action={
            <Button size="sm" variant="secondary" onClick={onUpdate}>
              {L.updateAction}
            </Button>
          }
        >
          {L.updateRecommendedBody}
        </Alert>
      )}
      {children}
    </>
  )
}
