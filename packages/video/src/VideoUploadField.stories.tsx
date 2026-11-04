import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useRef, useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { koVideoUploadLabels } from './labels'
import type { PartPut } from './putPart'
import { UploadPartError } from './uploadVideo'
import { createFakeVideoBackend, storyItem } from './stories/fakeVideo'
import { WithQuery } from './stories/WithQuery'
import type { VideoItem } from './types'
import type { VideoApi } from './videoApi'
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
  breakNetwork = false,
  breakAttach = false,
}: {
  items?: VideoItem[]
  stepMs?: number
  putMs?: number
  max?: number
  ko?: boolean
  /** 조각 올리기가 네트워크 오류로 끝나게 한다 - 「다시 시도」 를 누르면 풀린다 */
  breakNetwork?: boolean
  /** 앱의 `onUploaded` 가 첫 번에는 던진다 - 「다시 붙이기」 를 누르면 받는다 */
  breakAttach?: boolean
}) {
  const [{ api: fakeApi, put: fakePut }] = useState(() =>
    createFakeVideoBackend({ items, stepMs, putMs }),
  )
  const network = useRef(breakNetwork)
  // 두 번째 올리기(「다시 시도」)부터는 네트워크가 돌아온다
  const api = useMemo<VideoApi>(
    () => ({
      ...fakeApi,
      start: async (input) => {
        const started = await fakeApi.start(input)
        if (startedOnce.current) network.current = false
        startedOnce.current = true
        return started
      },
    }),
    [fakeApi],
  )
  const startedOnce = useRef(false)
  const attach = useRef(breakAttach)
  const put: PartPut = (target, blob, hooks) => {
    if (!network.current) return fakePut(target, blob, hooks)
    return Promise.reject(new UploadPartError(target.number))
  }
  return (
    <WithQuery>
      <VideoUploadField
        api={api}
        purpose="clip"
        max={max}
        put={put}
        pollMs={100}
        resume={false}
        onUploaded={async () => {
          if (attach.current) {
            attach.current = false
            throw new Error('the app could not save the video')
          }
        }}
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

// 기본 설정(max=1)에서도 올리다 만 줄이 자리를 막지 않는다 - 같은 파일을 다시 골라 이어 올릴 수 있다
export const AnInterruptedUploadDoesNotFillTheMaximum: Story = {
  args: {
    max: 1,
    items: [storyItem({ id: 'u1', status: 'UPLOADING', compat: 'NONE', ladder: 'NONE' })],
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/Choose the same file again to continue/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Choose a video' })).toBeEnabled()
    await expect(canvas.queryByText('You can add up to 1.')).toBeNull()
  },
}

// 네트워크로 멈춘 줄: 서버를 지우지 않는 「다시 시도」 와 「지우기」 가 따로, 자리도 안 막는다
export const RetriesAfterANetworkFailure: Story = {
  args: { breakNetwork: true, max: 1 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(input(canvas), clip())
    const retry = await canvas.findByRole(
      'button',
      { name: 'Try uploading clip.mp4 again' },
      { timeout: 10_000 },
    )
    await expect(canvas.getByRole('button', { name: 'Remove clip.mp4' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Choose a video' })).toBeEnabled()
    await userEvent.click(retry)
    await expect(await canvas.findByText('Ready to play', {}, { timeout: 8000 })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Try uploading clip.mp4 again' })).toBeNull()
  },
}

// 올리기는 끝났는데 앱이 영상을 저장하지 못했다 - 영상이 보이지 않는 채 쌓이지 않게 그 줄이 「다시 붙이기」 · 「지우기」 를 둔다
export const KeepsTheVideoWhenTheAppCannotSaveIt: Story = {
  args: { breakAttach: true, max: 1 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(input(canvas), clip())
    const again = await canvas.findByRole('button', { name: 'Attach clip.mp4 again' })
    await expect(await canvas.findByRole('alert')).toHaveTextContent(/could not be saved/)
    await expect(canvas.getByRole('button', { name: 'Remove clip.mp4' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Choose a video' })).toBeDisabled()
    await userEvent.click(again)
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: 'Attach clip.mp4 again' })).toBeNull(),
    )
    await expect(await canvas.findByText(/Ready to play|Preparing/)).toBeVisible()
  },
}

export const RemovesAVideoTheAppCannotSave: Story = {
  args: { breakAttach: true, max: 1 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(input(canvas), clip())
    await canvas.findByRole('button', { name: 'Attach clip.mp4 again' })
    await userEvent.click(canvas.getByRole('button', { name: 'Remove clip.mp4' }))
    await waitFor(() => expect(canvas.queryByRole('listitem')).toBeNull())
    await expect(canvas.getByRole('button', { name: 'Choose a video' })).toBeEnabled()
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
