import { useAuth } from '@skeleton/auth'
import { AuthorProfileManager } from '@skeleton/author-profile'
import { boardKeys } from '@skeleton/board'
import { setTheme, THEMES, useTheme, type Theme } from '@skeleton/theme'
import { Button, Card, Field, PageHeader, Select } from '@skeleton/ui'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { profileApi } from '../author/api'
import { authorProfileLabels } from '../author/profileLabels'
import { shownName } from '../auth/profileDisplay'
import { useMyProfile } from '../auth/useMyProfile'
import { useT } from '../i18n'
import styles from './SettingsPage.module.css'

/**
 * Patterns/Settings page — 즉시 적용(테마) 한 카드 · 읽기 전용 계정 카드 · 글 · 댓글에 쓰는 프로필 구역(`#profiles`) · 세션(로그아웃). 서버에 저장할 설정은 아직 없어 저장 폼은 두지 않았다.
 * 계정 id 는 화면 · aria 어디에도 그리지 않는다(프로필 뒤의 계정을 드러내는 값이라 접힌 구역에도 두지 않는다)
 */
export function SettingsPage() {
  const { t } = useT()
  const { principal, logout } = useAuth()
  const profile = useMyProfile().data
  const nickname = shownName(profile)
  const theme = useTheme()
  const navigate = useNavigate()
  const { hash } = useLocation()

  // 안내 띠의 「프로필 이름 붙이기」가 `/settings#profiles` 로 보낸다 — 라우터는 해시로 스크롤하지 않으므로 그 구역으로 내린다(선택기의 「프로필 만들기」는 대화상자라 여기로 오지 않는다)
  useEffect(() => {
    if (hash !== '#profiles') return
    const section = document.getElementById('profiles')
    section?.scrollIntoView({ block: 'start' })
    const heading = section?.querySelector('h2')
    heading?.setAttribute('tabindex', '-1') // 구역 제목으로 포커스 — 낭독기가 어디에 왔는지 읽는다
    heading?.focus()
  }, [hash])

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
            <dt>{t('settings.nickname')}</dt>
            <dd>
              {nickname ?? (
                <>
                  {t('settings.nicknameNone')} ·{' '}
                  <Link to="/account#profile">{t('settings.nicknameSet')}</Link>
                </>
              )}
              <small className={styles.hint}>{t('settings.nicknameHint')}</small>
            </dd>
          </div>
          <div>
            <dt>{t('settings.email')}</dt>
            <dd>{profile?.email ?? principal?.email ?? t('common.none')}</dd>
          </div>
          <div>
            <dt>{t('settings.roles')}</dt>
            <dd>{principal?.roles.join(', ') || t('common.none')}</dd>
          </div>
        </dl>
        <Link to="/account">{t('settings.manageAccount')}</Link>
      </Card>
      <Card id="profiles" title={t('settings.profiles')}>
        <p>{t('settings.profilesHint')}</p>
        <AuthorProfileManager
          api={profileApi}
          labels={authorProfileLabels(t)}
          alsoInvalidate={[boardKeys.all]}
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
