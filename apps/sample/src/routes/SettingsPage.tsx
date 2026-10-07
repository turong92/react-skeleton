import { useAuth } from '@skeleton/auth'
import { setTheme, THEMES, useTheme, type Theme } from '@skeleton/theme'
import { Button, Card, CopyButton, Field, PageHeader, SectionCard, Select } from '@skeleton/ui'
import { Link, useNavigate } from 'react-router-dom'
import { shownName } from '../auth/profileDisplay'
import { useMyProfile } from '../auth/useMyProfile'
import { useT } from '../i18n'
import styles from './SettingsPage.module.css'

/** Patterns/Settings page — 즉시 적용(테마) 한 카드 · 읽기 전용 계정 카드 · 세션(로그아웃). 서버에 저장할 설정은 아직 없어 저장 폼은 두지 않았다 */
export function SettingsPage() {
  const { t } = useT()
  const { principal, logout } = useAuth()
  const profile = useMyProfile().data
  const nickname = shownName(profile)
  const accountId = profile?.id ?? principal?.accountId
  const theme = useTheme()
  const navigate = useNavigate()

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
      <SectionCard
        id="support"
        title={t('settings.support')}
        description={t('settings.supportHint')}
        collapsible
        defaultExpanded={false}
      >
        <dl className={styles.list}>
          <div>
            <dt>{t('settings.accountId')}</dt>
            <dd className={styles.idRow}>
              <code>{accountId ?? t('common.none')}</code>
              {accountId && <CopyButton value={accountId} label={t('common.copy')} />}
            </dd>
          </div>
        </dl>
      </SectionCard>
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
