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
import { strings } from '../strings'
import styles from './NoteDetailPage.module.css'

const t = strings.detail

function NoteDetail({ note }: { note: Note }) {
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
    toast.success(t.exportStarted)
  }

  return (
    <div className={styles.page}>
      <PageHeader
        back={<Link to="/notes">← {t.back}</Link>}
        title={note.title}
        description={`${t.updated} ${formatInstant(note.updatedAt)}`}
        actions={
          <>
            <Button
              variant="secondary"
              loading={exportNote.isPending}
              loadingLabel={t.exporting}
              onClick={() => void startExport()}
            >
              {t.export}
            </Button>
            <Button onClick={() => navigate(`/notes/${note.id}/edit`)}>
              {strings.common.edit}
            </Button>
          </>
        }
      />
      <div className={styles.badges}>
        <NoteStatusBadge status={note.status} />
        {note.pinned && <Badge tone="info">{strings.notes.pinned}</Badge>}
      </div>

      <Tabs
        aria-label={t.sections}
        items={[
          {
            id: 'content',
            label: t.tabContent,
            content: (
              <Card>
                {note.body ? (
                  <p className={styles.body}>{note.body}</p>
                ) : (
                  <p className={styles.empty}>{t.bodyEmpty}</p>
                )}
                <dl className={styles.meta}>
                  <div>
                    <dt>{t.created}</dt>
                    <dd>{formatInstant(note.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>{t.updated}</dt>
                    <dd>{formatInstant(note.updatedAt)}</dd>
                  </div>
                </dl>
              </Card>
            ),
          },
          {
            id: 'attachment',
            label: t.tabAttachment,
            content: <AttachmentPanel note={note} />,
          },
        ]}
      />

      <Card title={t.deleteSection}>
        <div className={styles.danger}>
          <p>{t.deleteHint}</p>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t.deleteButton}
          </Button>
        </div>
      </Card>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.deleteTitle(note.title)}
        closeLabel={strings.common.close}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {strings.common.cancel}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              {t.deleteConfirm}
            </Button>
          </>
        }
      >
        <p>{t.deleteBody}</p>
      </Dialog>
    </div>
  )
}

/** Patterns/Detail page — 제목 + 액션 · 탭(내용 / 첨부) · 위험 구역(삭제는 확인) · 로딩 · 없음 */
export function NoteDetailPage() {
  const { id = '' } = useParams()
  const note = useNote(id)
  if (note.isPending) return <Spinner label={strings.common.loading} />
  if (note.isError) {
    if (isErrorCode(note.error, NoteErrorCodes.NOT_FOUND))
      return (
        <EmptyState
          headingLevel={2}
          title={t.notFoundTitle}
          description={t.notFoundBody}
          action={<Link to="/notes">{t.back}</Link>}
        />
      )
    return <LoadError onRetry={() => void note.refetch()} />
  }
  return <NoteDetail note={note.data} />
}
