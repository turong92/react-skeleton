import { Alert, Button, SectionCard } from '@skeleton/ui'
import type { LoginIdRules } from '../account/loginIdRules'
import type { LoginIdAvailability } from '../account/types'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { LoginIdChoice } from './LoginIdChoice'
import { labelOfMethod } from './methodsList'

export type LoginIdSectionProps = {
  /** 정한 아이디, 아직 안 정했으면 null (`me.loginId` — 키가 없는 서버에서는 이 구역을 그리지 않는다) */
  loginId: string | null
  hasPassword: boolean
  /** 계정 주소(없으면 null) - 비밀번호 없는 계정의 단추가 비밀번호 구역으로 갈지 이메일 구역으로 갈지 고른다 */
  email: string | null
  /** 지금 로그인에 쓰는 제공자 코드(`kakao` …) - 「지금은 {제공자}(으)로 로그인해요」 */
  provider?: string
  rules: LoginIdRules
  api: { checkLoginId: (loginId: string) => Promise<LoginIdAvailability> }
  /** 아직 안 정한 계정이 여기서 정한다 - `POST /account/login-id` */
  onSubmit: (loginId: string) => Promise<unknown>
  onChosen: () => void
  onAlreadySet: () => void
  /** 비밀번호 없는 계정의 단추 - 그 구역으로 간다. 없으면(그 구역을 끈 앱) 단추를 그리지 않는다 */
  onGo?: (target: 'password' | 'email') => void
  labels?: Partial<AuthLabels>
}

/**
 * 설정의 「아이디」 줄 - 세 상태.
 * 정했다: 값 + 「바꿀 수 없어요」(고치는 요소가 없다). 정했고 비밀번호가 없다(소셜로만 들어온다): 거기에 안내와, 주소가 있으면 「비밀번호 만들기」 · 없으면 「이메일 등록하기」(테두리 단추).
 * 아직 안 정했다(막이 걷힌 `/account`): 게이트와 같은 칸 · 같은 확인 대화상자로 여기서 정한다.
 */
export function LoginIdSection({
  loginId,
  hasPassword,
  email,
  provider,
  rules,
  api,
  onSubmit,
  onChosen,
  onAlreadySet,
  onGo,
  labels: given,
}: LoginIdSectionProps) {
  const labels = mergeLabels(given)
  const id = 'login-id'
  if (loginId === null)
    return (
      <SectionCard id={id} title={labels.loginId} description={labels.loginIdRequiredBody}>
        <LoginIdChoice
          rules={rules}
          api={api}
          onSubmit={onSubmit}
          onChosen={onChosen}
          onAlreadySet={onAlreadySet}
          labelledBy={`${id}-title`}
          labels={labels}
        />
      </SectionCard>
    )
  const target = email ? 'password' : 'email'
  return (
    <SectionCard id={id} title={labels.loginId}>
      <div className={styles.stack}>
        <div className={styles.row}>
          <strong className={styles.loginIdValue}>{loginId}</strong>
          <span className={styles.muted}>{labels.settingsLoginIdFixed}</span>
        </div>
        {!hasPassword && (
          <>
            <Alert tone="info">
              {labels.settingsLoginIdNoPassword(labelOfMethod(provider ?? 'magic_link', labels))}
            </Alert>
            {onGo && (
              <div className={styles.row}>
                <Button variant="secondary" onClick={() => onGo(target)}>
                  {email ? labels.settingsLoginIdSetPassword : labels.settingsLoginIdAddEmail}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  )
}
