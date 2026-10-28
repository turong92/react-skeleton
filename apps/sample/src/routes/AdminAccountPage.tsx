import { defaultAuthLabels, koAuthLabels } from '@skeleton/auth'
import { formatInstant } from '@skeleton/time'
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '@skeleton/ui'
import { useQuery } from '@tanstack/react-query'
import { ApiRequestError } from '@skeleton/api-client'
import { useParams } from 'react-router-dom'
import { adminAccountsApi } from '../adminAccounts/api'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { languageOf, useT } from '../i18n'
import styles from './AdminAccountPage.module.css'

const isNotFound = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404

/**
 * 계정 한 건(읽기) - 이메일 · 로그인 아이디 · 상태 · 역할 · 가입 · 마지막 로그인. 다른 운영 화면(쿠폰 발급 내역 …)이 계정 칸을 여기로 잇는다.
 * 정지 · 역할 주기는 계정 목록 화면(`/admin/accounts`)에서 한다. 백엔드 `account.read`
 */
export function AdminAccountPage() {
  const { id = '' } = useParams()
  const { t, locale } = useT()
  const language = languageOf(locale)
  const status = (language === 'ko' ? koAuthLabels : defaultAuthLabels).adminStatus
  const account = useQuery({
    queryKey: ['admin-account', id],
    queryFn: () => adminAccountsApi.get(id),
    retry: false,
    meta: { quietStatuses: [404] },
  })
  const back = (
    <LinkButton to="/admin/accounts" variant="secondary">
      {t('admin.account.back')}
    </LinkButton>
  )
  if (account.isPending) return <Skeleton lines={3} label={t('common.loading')} />
  if (account.isError || !account.data)
    return (
      <div className={styles.page}>
        <div>{back}</div>
        {isNotFound(account.error) ? (
          <EmptyState title={t('admin.account.notFound')} headingLevel={2} />
        ) : (
          <LoadError error={account.error} onRetry={() => void account.refetch()} />
        )}
      </div>
    )
  const a = account.data
  const when = (iso: string | null) => (iso ? formatInstant(iso, { locale: language }) : '-')
  return (
    <div className={styles.page}>
      <PageHeader title={a.email ?? a.loginId ?? a.id} back={back} />
      <Card>
        <dl className={styles.facts}>
          <Fact label={t('admin.account.email')}>{a.email ?? '-'}</Fact>
          <Fact label={t('admin.account.loginId')}>{a.loginId ?? '-'}</Fact>
          <Fact label={t('admin.account.status')}>
            <Badge>{status[a.status as keyof typeof status] ?? a.status}</Badge>
          </Fact>
          <Fact label={t('admin.account.roles')}>
            {a.roles.length === 0 ? t('admin.account.rolesNone') : a.roles.join(', ')}
          </Fact>
          <Fact label={t('admin.account.createdAt')}>{when(a.createdAt)}</Fact>
          <Fact label={t('admin.account.lastLogin')}>{when(a.lastLoginAt)}</Fact>
        </dl>
      </Card>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
