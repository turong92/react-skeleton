import { formatInstant } from '@skeleton/time'
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, Spinner, Tabs } from '@skeleton/ui'
import { useState } from 'react'
import { toast } from 'sonner'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AttachmentPanel } from '../components/AttachmentPanel'
import { LoadError } from '../components/LoadError'
import { NoteStatusBadge } from '../components/NoteStatusBadge'
import { useDeleteNote, useExportNote, useNote } from '../notes/queries'
import { NoteErrorCodes, type Note } from '../notes/types'
import { isErrorCode } from '@skeleton/api-client'
import { useT } from '../i18n'
import styles from './NoteDetailPage.module.css'

function NoteDetail({ note }: { note: Note }) {
  const { t } = useT()
  const navigate = useNavigate()
  const remove = useDeleteNote()
  const exportNote = useExportNote()
  const [confirming, setConfirming] = useState(false)

  async function confirmDelete() {
    await remove.mutateAsync(note.id)
    setConfirming(false)
    navigate('/notes', { replace: true })
  }

  async function startExport() {
    await exportNote.mutateAsync(note.id)
    toast.success(t('detail.exportStarted'))
  }

  return (
    <div className={styles.page}>
      <PageHeader
        back={<Link to="/notes">← {t('detail.back')}</Link>}
        title={note.title}
        description={`${t('detail.updated')} ${formatInstant(note.updatedAt)}`}
        actions={
          <>
            <Button
              variant="secondary"
              loading={exportNote.isPending}
              loadingLabel={t('detail.exporting')}
              onClick={() => void startExport()}
            >
              {t('detail.export')}
            </Button>
            <Button onClick={() => navigate(`/notes/${note.id}/edit`)}>{t('common.edit')}</Button>
          </>
        }
      />
      <div className={styles.badges}>
        <NoteStatusBadge status={note.status} />
        {note.pinned && <Badge tone="info">{t('notes.pinned')}</Badge>}
      </div>

      <Tabs
        aria-label={t('detail.sections')}
        items={[
          {
            id: 'content',
            label: t('detail.tabContent'),
            content: (
              <Card>
                {note.body ? (
                  <p className={styles.body}>{note.body}</p>
                ) : (
                  <p className={styles.empty}>{t('detail.bodyEmpty')}</p>
                )}
                <dl className={styles.meta}>
                  <div>
                    <dt>{t('detail.created')}</dt>
                    <dd>{formatInstant(note.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>{t('detail.updated')}</dt>
                    <dd>{formatInstant(note.updatedAt)}</dd>
                  </div>
                </dl>
              </Card>
            ),
          },
          {
            id: 'attachment',
            label: t('detail.tabAttachment'),
            content: <AttachmentPanel note={note} />,
          },
        ]}
      />

      <Card title={t('detail.deleteSection')}>
        <div className={styles.danger}>
          <p>{t('detail.deleteHint')}</p>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t('detail.deleteButton')}
          </Button>
        </div>
      </Card>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('detail.deleteTitle', { title: note.title })}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              {t('detail.deleteConfirm')}
            </Button>
          </>
        }
      >
        <p>{t('detail.deleteBody')}</p>
      </Dialog>
    </div>
  )
}

/** Patterns/Detail page — 제목 + 액션 · 탭(내용 / 첨부) · 위험 구역(삭제는 확인) · 로딩 · 없음 */
export function NoteDetailPage() {
  const { t } = useT()
  const { id = '' } = useParams()
  const note = useNote(id)
  if (note.isPending) return <Spinner label={t('common.loading')} />
  if (note.isError) {
    if (isErrorCode(note.error, NoteErrorCodes.NOT_FOUND))
      return (
        <EmptyState
          headingLevel={2}
          title={t('detail.notFoundTitle')}
          description={t('detail.notFoundBody')}
          action={<Link to="/notes">{t('detail.back')}</Link>}
        />
      )
    return <LoadError error={note.error} onRetry={() => void note.refetch()} />
  }
  return <NoteDetail note={note.data} />
}
