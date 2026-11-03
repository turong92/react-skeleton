import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import type { HlsCtor, LoadHls } from './attachSource'
import { koVideoPlayerLabels } from './labels'
import type { PlaybackEnv } from './playbackPlan'
import { storyGrant } from './stories/fakeVideo'
import type { VideoPlayback } from './types'
import { VideoPlayer } from './VideoPlayer'

/**
 * 영상 재생 - 포스터 + 재생 단추. **누르기 전에는 영상 파일도 hls.js 도 받지 않는다.**
 * 순서: 마스터(자동) → 이 기기가 원본 코덱을 틀면 원본 단 → 호환 단. 틀지 못하면 다음 순서로 같은 시각에서 넘어간다.
 * 네이티브 HLS 가 있으면 `<video src>`, 없으면 MSE 위에 hls.js(light, 누를 때 지연 로드), 둘 다 없으면 안내.
 * 판이 둘 이상이면 화질 칩(자동 / 720p / 원본) - 바꿔도 시각을 잇는다. 내려받기 단추는 없다.
 * 스토리는 `env`(이 기기가 무엇을 트는가)와 `loadHls`(가짜 hls.js)를 바꿔 끼워 각 갈래를 보인다 - 앱은 둘 다 주지 않는다.
 */
const NATIVE: PlaybackEnv = { canPlayType: () => true, mse: null }
const MSE_ONLY: PlaybackEnv = { canPlayType: () => false, mse: { isTypeSupported: () => true } }
const NOTHING: PlaybackEnv = { canPlayType: () => false, mse: null }

/** 불러온 횟수와 불러간 주소를 기록하는 가짜 hls.js - `failing` 에 든 주소는 치명 오류를 낸다 */
function fakeHls(failing: string[], changed: (loads: number, sources: string[]) => void) {
  const record = { loads: 0, sources: [] as string[] }
  class Hls {
    static Events = { ERROR: 'hlsError' }
    static isSupported = () => true
    private handler: ((event: string, data: { fatal?: boolean }) => void) | null = null
    on(_name: string, handler: (event: string, data: { fatal?: boolean }) => void) {
      this.handler = handler
    }
    loadSource(url: string) {
      record.sources.push(url)
      changed(record.loads, [...record.sources])
      if (failing.includes(url)) queueMicrotask(() => this.handler?.('hlsError', { fatal: true }))
    }
    attachMedia() {}
    destroy() {}
  }
  const loadHls: LoadHls = async () => {
    record.loads += 1
    changed(record.loads, [...record.sources])
    return Hls as unknown as HlsCtor
  }
  return { loadHls }
}

function Demo({
  grant = storyGrant(),
  env = NATIVE,
  failing = [],
  expiredAtFirst = false,
  ko = false,
}: {
  grant?: VideoPlayback
  env?: PlaybackEnv
  failing?: string[]
  expiredAtFirst?: boolean
  ko?: boolean
}) {
  const [seen, setSeen] = useState({ loads: 0, sources: [] as string[] })
  const [{ loadHls }] = useState(() =>
    fakeHls(failing, (loads, sources) => setSeen({ loads, sources })),
  )
  const [refreshed, setRefreshed] = useState(0)
  const [given] = useState(() =>
    expiredAtFirst ? { ...grant, expiresAt: '2000-01-01T00:00:00Z' } : grant,
  )
  return (
    <>
      <VideoPlayer
        grant={given}
        env={env}
        loadHls={loadHls}
        labels={ko ? koVideoPlayerLabels : undefined}
        refreshGrant={
          expiredAtFirst
            ? async () => {
                setRefreshed((n) => n + 1)
                return { ...grant, hls: 'https://video.test/v/a/h-2/master.m3u8' }
              }
            : undefined
        }
      />
      <p data-testid="log">{`loads=${seen.loads} sources=${seen.sources.join(',')} refreshed=${refreshed}`}</p>
    </>
  )
}

const meta = {
  title: 'Packages/video/VideoPlayer',
  component: Demo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const NativeHlsPlaysTheMaster: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByLabelText('Video')).toBeNull() // 누르기 전에는 영상 요소도 없다
    await userEvent.click(canvas.getByRole('button', { name: 'Play video, 0:42' }))
    const video = (await canvas.findByLabelText('Video')) as HTMLVideoElement
    await expect(video).toHaveAttribute('controlsList', 'nodownload')
    await waitFor(() => expect(video.getAttribute('src')).toContain('/h-1/master.m3u8'))
    await expect(canvas.getByTestId('log')).toHaveTextContent('loads=0') // hls.js 를 받지 않았다
  },
}

export const HlsjsLoadsOnlyWhenPressed: Story = {
  args: { env: MSE_ONLY },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByTestId('log')).toHaveTextContent('loads=0')
    await userEvent.click(canvas.getByRole('button', { name: 'Play video, 0:42' }))
    await waitFor(() =>
      expect(canvas.getByTestId('log')).toHaveTextContent(
        'loads=1 sources=https://video.test/v/a/h-1/master.m3u8',
      ),
    )
  },
}

export const FallsThroughToTheNextStepWhenOneFails: Story = {
  args: { env: MSE_ONLY, failing: ['https://video.test/v/a/h-1/master.m3u8'] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play video, 0:42' }))
    await waitFor(() =>
      expect(canvas.getByTestId('log')).toHaveTextContent(
        'sources=https://video.test/v/a/h-1/master.m3u8,https://video.test/v/a/o-1/index.m3u8',
      ),
    )
  },
}

export const GivesUpWhenEveryStepFails: Story = {
  args: {
    env: MSE_ONLY,
    grant: storyGrant({ hls: undefined, compat: undefined }),
    failing: ['https://video.test/v/a/o-1/index.m3u8'],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play video, 0:42' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The video could not be played',
    )
    await expect(canvas.getByRole('button', { name: 'Play video, 0:42' })).toBeEnabled() // 다시 누를 수 있다
  },
}

export const QualityChipSwitchesTheStep: Story = {
  args: { env: MSE_ONLY },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play video, 0:42' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Quality: Auto' }))
    await expect(canvas.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Auto',
      '720p',
      'Original',
    ])
    await userEvent.click(canvas.getByRole('menuitemradio', { name: '720p' }))
    await waitFor(() =>
      expect(canvas.getByTestId('log')).toHaveTextContent('https://video.test/v/a/c-1/index.m3u8'),
    )
    await expect(canvas.getByRole('button', { name: 'Quality: 720p' })).toBeVisible()
  },
}

export const NoChipWhenThereIsOnlyOneChoice: Story = {
  args: { env: MSE_ONLY, grant: storyGrant({ hls: undefined, compat: undefined }) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play video, 0:42' }))
    await canvas.findByLabelText('Video')
    await expect(canvas.queryByRole('button', { name: /^Quality/ })).toBeNull()
  },
}

export const ExpiredTokenGetsAFreshGrantFirst: Story = {
  args: { env: MSE_ONLY, expiredAtFirst: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play video, 0:42' }))
    await waitFor(() =>
      expect(canvas.getByTestId('log')).toHaveTextContent(
        'sources=https://video.test/v/a/h-2/master.m3u8 refreshed=1',
      ),
    )
  },
}

export const PreparingWhenNothingPlayableYet: Story = {
  args: {
    grant: storyGrant({ hls: undefined, compat: undefined, codec: 'hvc1.1.6.L153.B0' }),
    env: { canPlayType: (m) => m.includes('mpegurl'), mse: null },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Getting your video ready/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Play video, 0:42' })).toBeDisabled()
  },
}

export const UnsupportedBrowser: Story = {
  args: { env: NOTHING, ko: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('이 브라우저에서는 재생할 수 없어요.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '영상 재생, 0:42' })).toBeDisabled()
  },
}
