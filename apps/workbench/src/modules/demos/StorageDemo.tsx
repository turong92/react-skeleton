import type { ApiClient } from '@skeleton/api-client'
import { createStorageApi, validateFile, type StorageValidationIssue } from '@skeleton/storage'
import { Button, Field, Input } from '@skeleton/ui'
import { useMemo, useState } from 'react'
import styles from './Demo.module.css'

const RULES = { maxSizeBytes: 1024 * 1024, allowedContentTypes: ['image/*'] }

/**
 * `@skeleton/storage` — 서버 검증(`POST /skeleton/storage/validate`, 워크벤치 데모)과 같은 규칙의 클라이언트 검사.
 * 실제 업로드(presign → PUT)는 앱이 `PresignedStorage` 를 부르는 컨트롤러를 열어야 해서 여기선 하지 않는다 — README 참고.
 */
export function StorageDemo({ client }: { client: ApiClient }) {
  const api = useMemo(
    () =>
      createStorageApi(client, {
        presign: '/files/presign',
        validate: '/skeleton/storage/validate',
      }),
    [client],
  )
  const [file, setFile] = useState<File | null>(null)
  const [local, setLocal] = useState<StorageValidationIssue[] | null>(null)
  const [remote, setRemote] = useState<StorageValidationIssue[] | null>(null)

  async function check() {
    if (!file) return
    setLocal(validateFile(file, RULES))
    setRemote(
      await api.validate!({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      }),
    )
  }

  return (
    <div className={styles.stack}>
      <p className={styles.note}>
        클라이언트 규칙: 최대 1 MiB · <code>image/*</code>. 서버(백엔드{' '}
        <code>skeleton.storage</code> 설정)는 자기 규칙으로 따로 답한다.
      </p>
      <div className={styles.row}>
        <Field label="파일">
          {(control) => (
            <Input
              {...control}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          )}
        </Field>
        <Button disabled={!file} onClick={() => void check()}>
          검증
        </Button>
      </div>
      {local && <pre>client: {JSON.stringify(local, null, 2)}</pre>}
      {remote && <pre>server: {JSON.stringify(remote, null, 2)}</pre>}
    </div>
  )
}
