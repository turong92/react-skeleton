import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor, type within } from 'storybook/test'
import { ImageUploadField } from './ImageUploadField'
import { koImageUploadLabels } from './imageUploadLabels'
import { createFakeStorage, TINY_PNG } from './stories/fakeStorage'
import { createUploader } from './uploader'

/**
 * 사진 올리기 — `FilePicker` 위에 장마다 로컬 미리보기 · 진행률 · 「처리 중」 · 서버 거절 문구 · 지우기.
 * 가짜 저장소(`stories/fakeStorage.ts`)가 서버의 완료 호출을 흉내 낸다: 파일 이름에 `reject` 가 있으면 거절(`CONTENT_MISMATCH`), `pending` 이 있으면 변환 중.
 */
function Demo({
  initial = [],
  max = 3,
  stepMs = 10,
  ko = false,
}: {
  initial?: string[]
  max?: number
  stepMs?: number
  ko?: boolean
}) {
  const [keys, setKeys] = useState(initial)
  const [{ uploader, api }] = useState(() => {
    const fake = createFakeStorage({ steps: 5, stepMs })
    return {
      api: fake.api,
      uploader: createUploader({ api: fake.api, transport: fake.transport, complete: true }),
    }
  })
  return (
    <>
      <ImageUploadField
        uploader={uploader}
        api={api}
        value={keys}
        onChange={setKeys}
        max={max}
        labels={ko ? koImageUploadLabels : undefined}
      />
      <p data-testid="keys">{keys.join(',')}</p>
    </>
  )
}

const meta = {
  title: 'Packages/storage/ImageUploadField',
  component: Demo,
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

const photo = (name: string) => new File([TINY_PNG], name, { type: 'image/png' })
const input = (canvas: ReturnType<typeof within>) =>
  canvas.getByLabelText('Choose photos', { selector: 'input' })

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Add photos' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Choose photos' })).toBeEnabled()
    await expect(canvas.queryByRole('listitem')).toBeNull()
  },
}

export const Uploading: Story = {
  args: { stepMs: 300 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(input(canvas), photo('cat.png'))
    await expect(
      await canvas.findByRole('progressbar', { name: 'Uploading cat.png' }),
    ).toBeVisible()
    await expect(canvas.getByRole('img', { name: 'cat.png' })).toBeVisible() // 로컬 미리보기
    await expect(canvas.getByRole('button', { name: 'Remove cat.png' })).toBeEnabled()
  },
}

export const Done: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(input(canvas), photo('cat.png'))
    await waitFor(() => expect(canvas.getByTestId('keys')).toHaveTextContent('demo/cat.png'))
    await expect(canvas.queryByRole('progressbar')).toBeNull()
    await expect(canvas.queryByText('Processing…')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Remove cat.png' }))
    await expect(canvas.getByTestId('keys')).toHaveTextContent('')
  },
}

/** 이미 붙은 키는 `api.images` 의 썸네일로 그린다 */
export const AttachedKeysShowServerThumbnails: Story = {
  args: { initial: ['uploads/u/a.png', 'uploads/u/b.png'] },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getAllByRole('img')).toHaveLength(2))
    const [first] = canvas.getAllByRole('img')
    await expect(first).toHaveAttribute('srcset')
  },
}

export const Processing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(input(canvas), photo('pending.png'))
    await expect(await canvas.findByText('Processing…')).toBeVisible()
  },
}

export const RejectedByTheServer: Story = {
  args: { ko: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(
      canvas.getByLabelText('사진 고르기', { selector: 'input' }),
      photo('reject.png'),
    )
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      '파일 내용이 종류와 달라요. 쓸 수 없는 파일이에요.',
    )
    await expect(canvas.getByTestId('keys')).toHaveTextContent('')
    await userEvent.click(canvas.getByRole('button', { name: 'reject.png 지우기' }))
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

export const StopsAtTheLimit: Story = {
  args: { initial: ['uploads/u/a.png'], max: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Choose photos' })).toBeDisabled()
    await expect(canvas.getByText('You can add up to 1.')).toBeVisible()
  },
}

/** 지우면 로컬 미리보기 주소를 `revoke` 한다(메모리를 붙잡지 않는다) */
export const RemovingRevokesThePreview: Story = {
  play: async ({ canvas, userEvent }) => {
    const revoked: string[] = []
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = (url) => {
      revoked.push(url)
      original(url)
    }
    try {
      await userEvent.upload(input(canvas), photo('cat.png'))
      await waitFor(() => expect(canvas.getByTestId('keys')).toHaveTextContent('demo/cat.png'))
      await userEvent.click(canvas.getByRole('button', { name: 'Remove cat.png' }))
      await waitFor(() => expect(revoked.some((url) => url.startsWith('blob:'))).toBe(true))
    } finally {
      URL.revokeObjectURL = original
    }
  },
}
