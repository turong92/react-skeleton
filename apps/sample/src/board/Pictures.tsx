import { useUpload } from '@skeleton/storage'
import { Button, FilePicker } from '@skeleton/ui'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { ATTACHMENT_RULES, storageApi, uploader } from '../storage/uploader'
import { uploadErrorMessage } from '../storage/uploadMessage'
import styles from './Pictures.module.css'

const IMAGE_ACCEPT = ATTACHMENT_RULES.allowedContentTypes
  .filter((type) => type.startsWith('image/'))
  .join(',')

/** 저장 키 → 그림 — 저장소가 주는 임시 주소로 그린다(키를 주소로 쓰지 않는다) */
export function Picture({ storageKey }: { storageKey: string }) {
  const { t } = useT()
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let live = true
    void storageApi
      .presignDownload?.(storageKey)
      .then((value) => live && setUrl(value ?? undefined))
    return () => {
      live = false
    }
  }, [storageKey])
  return url ? <img className={styles.picture} src={url} alt={t('board.pictures.alt')} /> : null
}

/** 댓글에 그림을 붙이는 칸 — 파일은 브라우저가 저장소로 직접 올리고 폼에는 키만 남는다. 로그인한 사람만(업로드가 로그인을 요구한다) */
export function PicturePicker({
  value,
  onChange,
  max,
}: {
  value: string[]
  onChange: (keys: string[]) => void
  max: number
}) {
  const { t } = useT()
  const up = useUpload(uploader)
  const uploading = up.status === 'uploading'
  const error = up.status === 'error' ? uploadErrorMessage(up.error) : undefined

  async function add(files: File[]) {
    const file = files[0]
    if (!file) return
    try {
      const result = await up.upload(file)
      if (result) onChange([...value, result.key])
      up.reset()
    } catch {
      // 상태(up.error)로 칸 아래에 보인다
    }
  }

  return (
    <div className={styles.picker}>
      {value.length > 0 && (
        <ul className={styles.list}>
          {value.map((key) => (
            <li key={key}>
              <Picture storageKey={key} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(value.filter((k) => k !== key))}
              >
                {t('board.pictures.remove')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <FilePicker
          title={t('board.pictures.pickTitle')}
          hint={t('board.pictures.pickHint')}
          buttonLabel={t('board.pictures.pickButton')}
          accept={IMAGE_ACCEPT}
          disabled={uploading}
          error={error}
          onFiles={(files) => void add(files)}
        />
      )}
    </div>
  )
}
