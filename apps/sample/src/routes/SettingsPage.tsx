import { useAuth } from '@skeleton/auth'
import { setTheme, THEMES, useTheme, type Theme } from '@skeleton/theme'
import { Button, Card, Field, PageHeader, Select } from '@skeleton/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { strings } from '../strings'
import styles from './SettingsPage.module.css'

const t = strings.settings

/** Patterns/Settings page — 즉시 적용(테마) 한 카드 · 읽기 전용 계정 카드 · 세션(로그아웃). 서버에 저장할 설정은 아직 없어 저장 폼은 두지 않았다 */
export function SettingsPage() {
  const { principal, logout } = useAuth()
  const theme = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  function signOut() {
    logout()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t.title} description={t.subtitle} />
      <Card title={t.appearance}>
        <Field label={t.theme} hint={t.themeHint}>
          {(control) => (
            <Select
              {...control}
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
            >
              {THEMES.map((name) => (
                <option key={name} value={name}>
                  {t.themes[name]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>
      <Card title={t.account}>
        <dl className={styles.list}>
          <div>
            <dt>{t.email}</dt>
            <dd>{principal?.email ?? strings.common.none}</dd>
          </div>
          <div>
            <dt>{t.accountId}</dt>
            <dd>{principal?.accountId ?? strings.common.none}</dd>
          </div>
          <div>
            <dt>{t.roles}</dt>
            <dd>{principal?.roles.join(', ') || strings.common.none}</dd>
          </div>
        </dl>
      </Card>
      <Card title={t.session}>
        <div className={styles.session}>
          <p>{t.sessionHint}</p>
          <Button variant="secondary" onClick={signOut}>
            {strings.header.signOut}
          </Button>
        </div>
      </Card>
    </div>
  )
}
