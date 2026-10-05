import { EmptyState } from '@skeleton/ui'
import { Link } from 'react-router-dom'
import { strings } from '../strings'

export function NotFoundPage() {
  return (
    <EmptyState
      headingLevel={2}
      title={strings.notFound.title}
      description={strings.notFound.body}
      action={<Link to="/">{strings.notFound.home}</Link>}
    />
  )
}
