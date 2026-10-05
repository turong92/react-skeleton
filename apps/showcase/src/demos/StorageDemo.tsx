import { createUploader, useUpload } from '@skeleton/storage'
import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { Case, Row } from '../components/Section'
import { createFakeStorage } from '../fakes/fakeStorage'

const MIB = 1024 * 1024

/** 가짜 `StorageApi` + 가짜 전송 — 진행률 · 취소를 눈으로 본다(`useUpload`) */
export function StorageDemo() {
  const [uploader] = useState(() => {
    const fake = createFakeStorage({ steps: 20, stepMs: 150 })
    return createUploader({
      api: fake.api,
      transport: fake.transport,
      rules: { maxSizeBytes: 5 * MIB },
    })
  })
  const up = useUpload(uploader)
  const start = (file: File) => void up.upload(file).catch(() => undefined)
  return (
    <>
      <Case label="upload">
        <Row>
          <Button
            onClick={() =>
              start(
                new File([new Uint8Array(2 * MIB)], 'sample.bin', {
                  type: 'application/octet-stream',
                }),
              )
            }
            disabled={up.status === 'uploading'}
          >
            2 MiB 가짜 파일 올리기
          </Button>
          <Button
            variant="secondary"
            onClick={() => start(new File([new Uint8Array(6 * MIB)], 'too-big.bin'))}
          >
            6 MiB (검증에서 거절)
          </Button>
          <Button variant="danger" onClick={up.abort} disabled={up.status !== 'uploading'}>
            취소
          </Button>
          <Button variant="ghost" onClick={up.reset}>
            초기화
          </Button>
        </Row>
      </Case>
      <Case label="progress">
        <progress max={1} value={up.progress} aria-label="업로드 진행률" />
        <span role="status">
          {up.status} · {Math.round(up.progress * 100)}%
        </span>
      </Case>
      {up.result && (
        <p>
          키: <code>{up.result.key}</code>
        </p>
      )}
      {up.status === 'error' && (
        <p>실패: {up.error instanceof Error ? up.error.message : '검증 오류'}</p>
      )}
    </>
  )
}
