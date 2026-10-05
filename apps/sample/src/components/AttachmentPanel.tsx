import { useUpload } from '@skeleton/storage'
import { Button, Card, FilePicker, Progress } from '@skeleton/ui'
import { useUpdateNote } from '../notes/queries'
import type { Note, NoteInput } from '../notes/types'
import { ATTACHMENT_ACCEPT, storageApi, uploader } from '../storage/uploader'
import { uploadErrorMessage } from '../storage/uploadMessage'
import { useT } from '../i18n'
import styles from './AttachmentPanel.module.css'

const inputOf = (note: Note, attachment: Pick<NoteInput, 'attachmentKey' | 'attachmentName'>) => ({
  title: note.title,
  body: note.body,
  status: note.status,
  pinned: note.pinned,
  ...attachment,
})

/**
 * 첨부 — 파일은 브라우저가 저장소로 직접 올린다(`@skeleton/storage`: 검증 → presign → PUT 진행률). 올린 키를 노트에 저장하면 끝.
 * 파일 고르기는 `FilePicker`(날 `<input type=file>` 금지), 진행률은 `Progress`.
 */
export function AttachmentPanel({ note }: { note: Note }) {
  const { t } = useT()
  const update = useUpdateNote(note.id)
  const up = useUpload(uploader)
  const uploading = up.status === 'uploading'
  const errorMessage = up.status === 'error' ? uploadErrorMessage(up.error) : undefined

  async function attach(files: File[]) {
    const file = files[0]
    if (!file) return
    try {
      const result = await up.upload(file)
      if (!result) return // 취소
      await update.mutateAsync(
        inputOf(note, { attachmentKey: result.key, attachmentName: file.name }),
      )
      up.reset()
    } catch {
      // 상태(up.error)로 칸 아래에 보인다. 노트 저장 실패는 전역 토스트가 이미 알렸다
    }
  }

  async function download(key: string) {
    const url = await storageApi.presignDownload?.(key)
    if (url) window.open(url, '_blank', 'noopener')
  }

  async function remove() {
    await update.mutateAsync(inputOf(note, { attachmentKey: null, attachmentName: null }))
  }

  return (
    <Card title={t('attachment.title')}>
      <div className={styles.body}>
        {note.attachmentKey ? (
          <div className={styles.current}>
            <div className={styles.file}>
              <span className={styles.label}>{t('attachment.current')}</span>
              <strong>{note.attachmentName ?? note.attachmentKey}</strong>
            </div>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void download(note.attachmentKey!)}
              >
                {t('attachment.download')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={update.isPending && !uploading}
                onClick={() => void remove()}
              >
                {t('attachment.remove')}
              </Button>
            </div>
          </div>
        ) : (
          <p className={styles.none}>{t('attachment.none')}</p>
        )}

        <FilePicker
          title={t('attachment.pickTitle')}
          hint={t('attachment.pickHint')}
          buttonLabel={t('attachment.pickButton')}
          accept={ATTACHMENT_ACCEPT}
          disabled={uploading}
          error={errorMessage}
          onFiles={(files) => void attach(files)}
        />

        {uploading && (
          <div className={styles.progress}>
            <Progress
              label={t('attachment.progressLabel')}
              value={up.progress}
              valueText={`${Math.round(up.progress * 100)}%`}
            />
            <Button variant="ghost" size="sm" onClick={up.abort}>
              {t('attachment.cancel')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
