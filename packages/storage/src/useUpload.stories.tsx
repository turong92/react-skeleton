import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { createFakeStorage } from './stories/fakeStorage'
import { createUploader } from './uploader'
import { useUpload } from './useUpload'

/**
 * 업로드 한 줄기 — `useUpload(uploader)` 가 `status`(idle · uploading · done · error · aborted) · `progress`(0..1) · `result` · `abort()` 를 준다.
 * 이 스토리는 가짜 `StorageApi` + 가짜 전송(`stories/fakeStorage.ts`)을 끼운다 — 검증(5 MiB 제한) → presign → 직접 PUT 의 같은 흐름이 백엔드 없이 돈다.
 */
const MIB = 1024 * 1024

function Demo({ stepMs }: { stepMs: number }) {
  const [uploader] = useState(() => {
    const fake = createFakeStorage({ steps: 10, stepMs })
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
      <Button
        disabled={up.status === 'uploading'}
        onClick={() =>
          start(
            new File([new Uint8Array(2 * MIB)], 'sample.bin', { type: 'application/octet-stream' }),
          )
        }
      >
        Upload 2 MiB
      </Button>
      <Button
        variant="secondary"
        onClick={() => start(new File([new Uint8Array(6 * MIB)], 'too-big.bin'))}
      >
        Upload 6 MiB
      </Button>
      <Button variant="danger" onClick={up.abort} disabled={up.status !== 'uploading'}>
        Cancel
      </Button>
      <Button variant="ghost" onClick={up.reset}>
        Reset
      </Button>
      <progress max={1} value={up.progress} aria-label="Upload progress" />
      <p role="status">
        {up.status} · {Math.round(up.progress * 100)}%
      </p>
      {up.result && <p>Key: {up.result.key}</p>}
      {up.status === 'error' && (
        <p role="alert">
          Failed: {up.error instanceof Error ? up.error.message : 'validation error'}
        </p>
      )}
    </>
  )
}

const meta = {
  title: 'Packages/storage/useUpload',
  component: Demo,
  args: { stepMs: 20 },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const UploadsWithProgress: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('idle')
    await userEvent.click(canvas.getByRole('button', { name: 'Upload 2 MiB' }))
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('uploading'))
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('done · 100%'))
    await expect(canvas.getByText('Key: demo/sample.bin')).toBeVisible()
  },
}

export const RejectsTooLargeFile: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Upload 6 MiB' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Failed')
    await expect(canvas.getByRole('status')).toHaveTextContent('error')
  },
}

export const CancelMidUpload: Story = {
  args: { stepMs: 200 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Upload 2 MiB' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Cancel' })).toBeEnabled())
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('aborted'))
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }))
    await expect(canvas.getByRole('status')).toHaveTextContent('idle')
  },
}
