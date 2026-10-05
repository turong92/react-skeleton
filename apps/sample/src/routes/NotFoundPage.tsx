import { EmptyState } from '@skeleton/ui'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'

export function NotFoundPage() {
  const { t } = useT()
  return (
    <EmptyState
      headingLevel={2}
      title={t('notFound.title')}
      description={t('notFound.body')}
      action={<Link to="/">{t('notFound.home')}</Link>}
    />
  )
}
