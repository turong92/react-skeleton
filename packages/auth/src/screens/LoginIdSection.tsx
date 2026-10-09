import { Alert, Button, SettingsRow } from '@skeleton/ui'
import type { LoginIdRules } from '../account/loginIdRules'
import type { LoginIdAvailability } from '../account/types'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { LoginIdChoice } from './LoginIdChoice'
import { SectionShell } from './SectionShell'
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
  /** 줄만 그린다(`AccountSettings` 의 카드 안) - 아니면 제목 있는 카드 한 장에 담는다 */
  row?: boolean
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
  row,
}: LoginIdSectionProps) {
  const labels = mergeLabels(given)
  const id = 'login-id'
  if (loginId === null)
    return (
      <SectionShell row={row} id={id} title={labels.loginId}>
        <SettingsRow label={labels.loginId} labelId={`${id}-title`}>
          <p className={styles.muted}>{labels.loginIdRequiredBody}</p>
          <LoginIdChoice
            rules={rules}
            api={api}
            onSubmit={onSubmit}
            onChosen={onChosen}
            onAlreadySet={onAlreadySet}
            labelledBy={`${id}-title`}
            labels={labels}
          />
        </SettingsRow>
      </SectionShell>
    )
  const target = email ? 'password' : 'email'
  return (
    <SectionShell row={row} id={id} title={labels.loginId}>
      <SettingsRow
        label={labels.loginId}
        value={
          <>
            <strong className={styles.loginIdValue}>{loginId}</strong>
            <span className={styles.muted}>{labels.settingsLoginIdFixed}</span>
          </>
        }
        action={
          !hasPassword &&
          onGo && (
            <Button variant="secondary" size="sm" onClick={() => onGo(target)}>
              {email ? labels.settingsLoginIdSetPassword : labels.settingsLoginIdAddEmail}
            </Button>
          )
        }
      >
        {!hasPassword && (
          <Alert tone="info">
            {labels.settingsLoginIdNoPassword(labelOfMethod(provider ?? 'magic_link', labels))}
          </Alert>
        )}
      </SettingsRow>
    </SectionShell>
  )
}
