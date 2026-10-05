import { NotFoundPage as NotFoundStatusPage } from '@skeleton/marketing'
import { LinkButton } from '../components/LinkButton'
import { useT } from '../i18n'

/** 404 — Patterns/NotFound 를 옮긴 것. 이유를 말하고 갈 곳을 준다. 검색에서는 라우트의 `handle.seo`(`indexable: false`)가 뺀다(SPA 는 HTTP 404 를 못 낸다) */
export function NotFoundPage() {
  const { t } = useT()
  return (
    <NotFoundStatusPage
      title={t('notFound.title')}
      description={t('notFound.body')}
      actions={<LinkButton to="/">{t('notFound.home')}</LinkButton>}
    />
  )
}
