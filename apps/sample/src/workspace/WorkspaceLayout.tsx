import { useAuth } from '@skeleton/auth'
import { WorkspaceProvider } from '@skeleton/workspace'
import { useMemo } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { workspaceApi } from './api'
import { currentWorkspace, lastWorkspaceMemoryFor } from './current'
import { workspaceLabelsFor } from './labels'
import { swapSlug, teamPath } from './paths'
import styles from './WorkspaceLayout.module.css'

/**
 * `/w/:slug/…` 의 틀 - 주소의 slug 를 팀으로 풀고(탭마다 독립) 풀린 뒤에만 아래 화면을 그린다.
 * 옛 slug 로 들어오면 새 slug 로 **replace** 이동(뒤로 가기에 옛 주소가 남지 않는다). 풀리면 「마지막에 쓴 팀」을 적는다(읽는 건 `/workspaces` 뿐)
 */
export function WorkspaceLayout() {
  const { t, locale } = useT()
  const { slug = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { principal } = useAuth()
  const accountId = principal?.accountId ?? ''
  const memory = useMemo(() => lastWorkspaceMemoryFor(accountId), [accountId])
  return (
    <WorkspaceProvider
      api={workspaceApi}
      slug={slug}
      current={currentWorkspace}
      memory={memory}
      labels={workspaceLabelsFor(languageOf(locale))}
      onCanonicalSlug={(next) => navigate(swapSlug(location, next), { replace: true })}
    >
      <nav className={styles.tabs} aria-label={t('workspace.tabsLabel')}>
        <NavLink to={teamPath(slug)} end={false}>
          {t('nav.notes')}
        </NavLink>
        <NavLink to={teamPath(slug, 'settings')}>{t('nav.settings')}</NavLink>
      </nav>
      <Outlet />
    </WorkspaceProvider>
  )
}
