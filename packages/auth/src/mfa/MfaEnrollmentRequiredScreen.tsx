import { Alert, Button, Skeleton } from '@skeleton/ui'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReauthSubject } from '../reauth/kind'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { EnrollDialog } from './EnrollDialog'
import type { MfaApi } from './mfaApi'
import styles from './MfaEnrollmentRequiredScreen.module.css'

export type MfaEnrollmentRequiredScreenProps = {
  api: MfaApi
  /** 다시 인증의 종류를 고르는 `me` 의 부분 - 아직 못 읽었으면 null(읽는 동안 단추 자리에 뼈대) */
  subject: ReauthSubject | null
  /** `POST /account/reauth/confirmation` - 비밀번호 없는 계정의 6자리 메일 */
  requestReauthCode?: () => Promise<unknown>
  /** 켰고 복구 코드를 저장했다 - 앱이 막을 걷는다 */
  onEnrolled: () => void
  /**
   * 서버가 증거 없는 등록(로그인 15분 안)을 받지 않았고 이 계정이 소셜 로그인뿐이다 - 그 제공자의 동의 왕복은 계정 설정에 있다.
   * 앱이 계정 설정의 2단계 줄로 보낸다(막은 거기서 걷힌다). 없으면 그 계정은 안내만 본다
   */
  onProviderReauth?: (provider: string) => void
  onSignOut: () => void
  /** `me` 를 못 읽었다(다시 시도) */
  loadFailed?: boolean
  onRetry?: () => void
  labels?: Partial<AuthLabels>
}

/**
 * 「2단계 인증을 켜 주세요」 - 2단계가 필수(운영자 등)인데 아직 등록 전인 계정이 앱 대신 보는 전면 화면(`MfaEnrollmentRequiredGate` 가 덮는다).
 * 켜기 마법사는 설정의 것(`EnrollDialog`)과 같다 - 다만 열자마자 본인 확인 없이 시작해 본다: 방금 로그인한 계정은 서버가 증거 없이 받는다(소셜 전용 계정도 지나간다).
 * 서버가 증거를 요구하면 평소처럼 비밀번호 · 메일 코드를 묻는다. 떠나는 길(로그아웃)은 늘 있다.
 */
export function MfaEnrollmentRequiredScreen({
  api,
  subject,
  requestReauthCode,
  onEnrolled,
  onProviderReauth,
  onSignOut,
  loadFailed,
  onRetry,
  labels: given,
}: MfaEnrollmentRequiredScreenProps) {
  const labels = mergeLabels(given)
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => heading.current?.focus(), [])

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className={styles.card}>
        <div>
          <h1 id={titleId} ref={heading} tabIndex={-1}>
            {labels.mfaGateTitle}
          </h1>
          <p className={styles.lead}>{labels.mfaGateBody}</p>
        </div>
        {loadFailed && (
          <Alert
            tone="danger"
            action={
              onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  {labels.mfaRetry}
                </Button>
              )
            }
          >
            {labels.mfaLoadFailed}
          </Alert>
        )}
        <div className={styles.actions}>
          {subject ? (
            <Button onClick={() => setOpen(true)}>{labels.mfaGateStart}</Button>
          ) : (
            !loadFailed && <Skeleton />
          )}
          <Button variant="secondary" onClick={onSignOut}>
            {labels.mfaGateSignOut}
          </Button>
        </div>
      </div>
      {subject && (
        <EnrollDialog
          api={api}
          subject={subject}
          requestReauthCode={requestReauthCode}
          labels={labels}
          givenLabels={given}
          open={open}
          mode="enable"
          startWithoutProof
          onProvider={onProviderReauth}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            onEnrolled()
          }}
        />
      )}
    </div>
  )
}
