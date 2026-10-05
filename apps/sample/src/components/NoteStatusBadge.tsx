import { Badge } from '@skeleton/ui'
import { useT } from '../i18n'
import type { NoteStatus } from '../notes/types'

const TONE = { DRAFT: 'warning', ACTIVE: 'success', ARCHIVED: 'neutral' } as const

/** 상태는 글자로 말한다(색만으로 구분하지 않는다) */
export function NoteStatusBadge({ status }: { status: NoteStatus }) {
  const { t } = useT()
  return <Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>
}
