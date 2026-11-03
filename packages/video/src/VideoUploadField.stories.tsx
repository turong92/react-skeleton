import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { koVideoUploadLabels } from './labels'
import { createFakeVideoBackend, storyItem } from './stories/fakeVideo'
import { WithQuery } from './stories/WithQuery'
import type { VideoItem } from './types'
import { VideoUploadField } from './VideoUploadField'

/**
 * 영상 올리기 칸 - 파일을 고르면 올리는 중 % → 서버가 준비 중 n% → 「재생할 수 있어요」 → 「다른 기기용 판 준비 중」 → 끝.
 * 실패하면 서버가 붙인 사유 코드가 문구로, 올리다 만 줄은 안내, 줄마다 지우기. 앱은 `createVideoApi(apiClient)` 를 `api` 로 주고 `QueryClientProvider` 안에 둔다.
 * 스토리는 가짜 서버(`stories/fakeVideo.ts`)가 단계를 `stepMs` 마다 한 단계씩 앞으로 보낸다.
 */
function Demo({
  items = [],
  stepMs = 250,
  putMs = 5,
  max,
  ko = false,
}: {
  items?: VideoItem[]
  stepMs?: number
  putMs?: number
  max?: number
  ko?: boolean
}) {
  const [{ api, put }] = useState(() => createFakeVideoBackend({ items, stepMs, putMs }))
  return (
    <WithQuery>
      <VideoUploadField
        api={api}
        purpose="clip"
        max={max}
        put={put}
        pollMs={100}
        resume={false}
        labels={ko ? koVideoUploadLabels : undefined}
      />
    </WithQuery>
  )
}

const meta = {
  title: 'Packages/video/VideoUploadField',
  component: Demo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

const clip = (name = 'clip.mp4', bytes = 3 * 1024 * 1024, type = 'video/mp4') =>
  new File([new Uint8Array(bytes)], name, { type })
const input = (canvas: ReturnType<typeof within>) =>
  canvas.getByLabelText('Choose a video', { selector: 'input' })

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Add a video' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Choose a video' })).toBeEnabled()
    await expect(canvas.queryByRole('listitem')).toBeNull()
  },
}

export const UploadsThenGetsReady: Story = {
  args: { putMs: 200 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(input(canvas), clip())
    await expect(
      await canvas.findByRole('progressbar', { name: 'Uploading clip.mp4' }),
    ).toBeVisible()
    await expect(await canvas.findByText(/^Preparing \d+%$/, {}, { timeout: 5000 })).toBeVisible()
    await expect(await canvas.findByText('Ready to play', {}, { timeout: 5000 })).toBeVisible()
    await expect(await canvas.findByText('Preparing a version for other devices')).toBeVisible()
    await waitFor(
      () => expect(canvas.queryByText('Preparing a version for other devices')).toBeNull(),
      {
        timeout: 5000,
      },
    )
    await expect(canvas.getByText('Ready to play')).toBeVisible()
  },
}

export const CancelWhileUploading: Story = {
  args: { putMs: 3000 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(input(canvas), clip())
    await userEvent.click(await canvas.findByRole('button', { name: 'Cancel uploading clip.mp4' }))
    await waitFor(() => expect(canvas.queryByRole('listitem')).toBeNull())
    await expect(canvas.getByRole('button', { name: 'Choose a video' })).toBeEnabled()
  },
}

export const RejectsOtherFormats: Story = {
  play: async ({ canvas, userEvent }) => {
    // 이름은 .mp4 라 파일 창 거름(accept)은 지나지만 형식이 webm 이다 - 서버에 보내지 않고 막는다
    await userEvent.upload(input(canvas), clip('clip.mp4', 10, 'video/webm'))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Only MP4 or MOV videos can be uploaded.',
    )
  },
}

export const ShowsTheFailReason: Story = {
  args: {
    items: [
      storyItem({
        id: 'f1',
        status: 'FAILED',
        failCode: 'UNSUPPORTED_FORMAT',
        compat: 'NONE',
        ladder: 'NONE',
      }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('This video format is not supported.')).toBeVisible()
  },
}

export const ShowsAnInterruptedUploadAndRemovesIt: Story = {
  args: { items: [storyItem({ id: 'u1', status: 'UPLOADING', compat: 'NONE', ladder: 'NONE' })] },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText(/This upload was interrupted/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Video 1' }))
    await waitFor(() => expect(canvas.queryByRole('listitem')).toBeNull())
  },
}

export const ClosesThePickerAtTheMaximum: Story = {
  args: { items: [storyItem({ id: 'p1' })], max: 1 },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Ready to play')).toBeVisible()
    await expect(canvas.getByText('You can add up to 1.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Choose a video' })).toBeDisabled()
  },
}

export const Korean: Story = {
  args: {
    ko: true,
    items: [
      storyItem({ id: 'k1', compat: 'RUNNING' }),
      storyItem({ id: 'k2', status: 'REMUXING', progress: 40 }),
    ],
    max: 3,
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('재생할 수 있어요')).toBeVisible()
    await expect(canvas.getByText('다른 기기용 판 준비 중')).toBeVisible()
    await expect(canvas.getByText('준비 중 40%')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '영상 고르기' })).toBeEnabled()
  },
}
