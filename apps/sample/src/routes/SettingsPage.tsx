import { useAuth, useEmailBeforeWrite } from '@skeleton/auth'
import { AuthorProfileManager } from '@skeleton/author-profile'
import { boardKeys } from '@skeleton/board'
import { setTheme, THEMES, useTheme, type Theme } from '@skeleton/theme'
import { Button, Card, Field, PageHeader, Select } from '@skeleton/ui'
import { useNavigate } from 'react-router-dom'
import { emailRequired } from '../api/emailRequired'
import { profileApi } from '../author/api'
import { authorProfileLabels } from '../author/profileLabels'
import { useMyProfile } from '../auth/useMyProfile'
import { LinkCard } from '../components/LinkCard'
import { useT } from '../i18n'
import styles from './SettingsPage.module.css'

/**
 * Patterns/Settings page — 즉시 적용(테마) 한 카드 · 읽기 전용 계정 카드(계정 이메일 · 연락받을 이메일 · 권한 + 계정 관리 링크 카드) · 응원 카드(「내 응원 내역」 링크 카드) · 글 · 댓글에 쓰는 「내 닉네임」 구역 · 세션(로그아웃). 서버에 저장할 설정은 아직 없어 저장 폼은 두지 않았다.
 * 사용자에게 닉네임은 하나다 — 계정에 붙은 이름(계정 닉네임)은 이 화면에 없다. 계정 id 는 화면 · aria 어디에도 그리지 않는다(닉네임 뒤의 계정을 드러내는 값이라 접힌 구역에도 두지 않는다)
 */
export function SettingsPage() {
  const { t } = useT()
  const { principal, logout } = useAuth()
  const profile = useMyProfile().data
  const theme = useTheme()
  const navigate = useNavigate()
  const emailBeforeWrite = useEmailBeforeWrite(emailRequired)
  const email = profile?.email ?? principal?.email ?? null

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <Card title={t('settings.appearance')}>
        <Field label={t('settings.theme')} hint={t('settings.themeHint')}>
          {(control) => (
            <Select
              {...control}
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
            >
              {THEMES.map((name) => (
                <option key={name} value={name}>
                  {t(`settings.themes.${name}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>
      <Card title={t('settings.account')}>
        <dl className={styles.list}>
          <div>
            <dt>{t('settings.email')}</dt>
            <dd>
              {email ?? (
                // 이메일이 없는 계정(주소를 안 주는 소셜 로그인) — 빈칸이 아니라 말로, 그리고 추가하는 길은 눌리는 단추로
                <span className={styles.noEmail}>
                  <span>{t('settings.emailNone')}</span>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/account#email')}>
                    {t('settings.emailAdd')}
                  </Button>
                </span>
              )}
            </dd>
          </div>
          {profile?.contactEmail !== undefined && (
            <div>
              <dt>{t('settings.contactEmail')}</dt>
              <dd>{profile.contactEmail ?? t('settings.contactEmailNone')}</dd>
            </div>
          )}
          <div>
            <dt>{t('settings.roles')}</dt>
            <dd>{principal?.roles.join(', ') || t('common.none')}</dd>
          </div>
        </dl>
        <LinkCard to="/account" description={t('settings.manageAccountHint')}>
          {t('settings.manageAccount')}
        </LinkCard>
      </Card>
      <Card title={t('settings.cheers')}>
        <LinkCard to="/cheers" description={t('settings.cheersHint')}>
          {t('settings.cheersLink')}
        </LinkCard>
      </Card>
      <Card id="nicknames" title={t('settings.nicknames')}>
        <p>{t('settings.nicknamesHint')}</p>
        <AuthorProfileManager
          api={profileApi}
          labels={authorProfileLabels(t)}
          alsoInvalidate={[boardKeys.all]}
          beforeRemove={emailBeforeWrite.ensure} // 삭제 확인 창을 열기 전에 이메일부터(창 안에서 막히면 이메일 화면이 창 밑에 깔린다)
        />
      </Card>
      <Card title={t('settings.session')}>
        <div className={styles.session}>
          <p>{t('settings.sessionHint')}</p>
          <Button variant="secondary" onClick={signOut}>
            {t('header.signOut')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
