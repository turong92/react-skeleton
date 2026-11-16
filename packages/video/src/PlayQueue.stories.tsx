import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import type { HlsCtor, LoadHls } from './attachSource'
import { MiniPlayer } from './MiniPlayer'
import { QueueProgress } from './QueueProgress'
import { QueueStage } from './QueueStage'
import type { YouTubeApi } from './youtubeApi'
import type { PlaybackEnv } from './playbackPlan'
import type { QueueItem } from './playQueue'
import { PlayQueueProvider } from './PlayQueueProvider'
import { koPlayQueueLabels } from './queueLabels'
import type { QueueStorage } from './queueStorage'
import { usePlayQueue } from './usePlayQueue'

/**
 * 재생 대기열 + 작은 재생기. `PlayQueueProvider` 를 **앱 최상단**에 두면 `<audio>` 하나가 곡마다 다시 쓰여
 * 화면이 꺼진 채로도 다음 곡으로 넘어가고, 라우트를 옮겨도 `MiniPlayer`(화면 아래에 붙는 작은 재생기)가 남는다.
 * 상태(목록 · 현재 곡 · 반복 · 셔플)는 이 기기에 저장되어 새로 고침 뒤에 복원된다(저절로 틀지는 않는다).
 * `VideoPlayer` 는 `usePlayQueue().playerProps` 를 펼쳐 주면 이 `<audio>` 를 빌려 쓴다.
 * 스토리는 가짜 hls.js 와 메모리 저장소를 꽂아 네트워크 없이 보인다 - 앱은 `env` · `loadHls` · `storage` 를 주지 않는다
 */
const MSE_ONLY: PlaybackEnv = { canPlayType: () => false, mse: { isTypeSupported: () => true } }

function quietHls(): LoadHls {
  class Hls {
    static Events = { ERROR: 'hlsError' }
    static isSupported = () => true
    on() {}
    loadSource() {}
    attachMedia() {}
    destroy() {}
  }
  return async () => Hls as unknown as HlsCtor
}

const song = (id: string, title: string): QueueItem => ({
  kind: 'media',
  id,
  title,
  artist: 'Example Artist',
  source: { src: `https://video.test/${id}/o.m3u8`, audio: `https://video.test/${id}/a.m3u8` },
})
const SONGS = [song('a', 'First song'), song('b', 'Second song'), song('c', 'Third song')]

function memoryStorage(initial?: string): QueueStorage {
  const data: Record<string, string> = initial ? { 'story.queue': initial } : {}
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => void (data[key] = value),
    removeItem: (key) => void delete data[key],
  }
}

function Controls() {
  const queue = usePlayQueue()
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => queue.setQueue(SONGS, { play: true })}>
        Load songs
      </button>
      <button type="button" onClick={() => queue.setRepeat('all')}>
        Repeat all
      </button>
      <button type="button" onClick={() => queue.setShuffle(true)}>
        Shuffle
      </button>
      <p data-testid="position">
        {queue.currentIndex + 1} / {queue.order.length}
      </p>
      <QueueProgress />
      {queue.canSetVolume && (
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={queue.volume}
          onChange={(event) => queue.setVolume(Number(event.target.value))}
        />
      )}
      <ol data-testid="upcoming">
        {queue.upcoming.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ol>
    </div>
  )
}

function Demo({ ko = false, saved }: { ko?: boolean; saved?: string }) {
  return (
    <PlayQueueProvider
      storageKey="story.queue"
      storage={memoryStorage(saved)}
      env={MSE_ONLY}
      loadHls={quietHls()}
    >
      <Controls />
      <MiniPlayer labels={ko ? koPlayQueueLabels : undefined} />
    </PlayQueueProvider>
  )
}

const meta = {
  title: 'Packages/video/PlayQueue',
  component: Demo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const EmptyQueueShowsNoMiniPlayer: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region', { name: 'Now playing' })).toBeNull()
  },
}

export const LoadingSongsShowsTheMiniPlayerAndTheUpNextList: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load songs' }))
    const mini = await canvas.findByRole('region', { name: 'Now playing' })
    await expect(mini).toHaveTextContent('First song')
    await expect(
      Array.from(canvas.getByTestId('upcoming').querySelectorAll('li')).map((li) => li.textContent),
    ).toEqual(['Second song', 'Third song'])
  },
}

export const ProgressBarIsThereAndWaitsForALength: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load songs' }))
    await expect(canvas.getByTestId('position')).toHaveTextContent('1 / 3')
    // 가짜 hls.js 는 아무것도 못 받아 길이를 모른다 - 막대는 있되 옮길 수 없다
    const bar = canvas.getByRole('slider', { name: 'Seek' })
    await expect(bar).toBeDisabled()
  },
}

export const NextMovesOnAndPlayPauseToggles: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load songs' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Next song' }))
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Now playing' })).toHaveTextContent('Second song'),
    )
    await expect(canvas.getByRole('button', { name: /^(Pause|Play)$/ })).toBeVisible()
  },
}

export const RestoresASavedQueueWithoutPlaying: Story = {
  args: {
    saved: JSON.stringify({
      v: 1,
      items: SONGS,
      original: ['a', 'b', 'c'],
      order: ['a', 'b', 'c'],
      currentId: 'b',
      repeat: 'all',
      shuffle: false,
    }),
  },
  play: async ({ canvas }) => {
    const mini = await canvas.findByRole('region', { name: 'Now playing' })
    await expect(mini).toHaveTextContent('Second song')
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible() // 저절로 틀지 않았다
  },
}

export const KoreanLabels: Story = {
  args: { ko: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load songs' }))
    await expect(await canvas.findByRole('region', { name: '지금 재생 중' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '다음 곡' })).toBeVisible()
  },
}

const YT: QueueItem = { kind: 'youtube', id: 'y', title: 'A youtube clip', videoId: 'dQw4w9WgXcQ' }

function YoutubeDemo({ failScript }: { failScript: boolean }) {
  return (
    <PlayQueueProvider
      storageKey="story.queue"
      storage={memoryStorage()}
      env={MSE_ONLY}
      loadHls={quietHls()}
    >
      <YoutubeControls />
      <QueueStage
        loadYouTubeApi={() =>
          failScript ? Promise.reject(new Error('blocked')) : new Promise<YouTubeApi>(() => {})
        }
      />
      <MiniPlayer />
    </PlayQueueProvider>
  )
}

function YoutubeControls() {
  const queue = usePlayQueue()
  return (
    <button type="button" onClick={() => queue.setQueue([YT, SONGS[0]!], { play: true })}>
      Load youtube then a song
    </button>
  )
}

export const YoutubeScriptFailureMovesOnToTheNextSong: StoryObj<typeof YoutubeDemo> = {
  render: () => <YoutubeDemo failScript />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load youtube then a song' }))
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Now playing' })).toHaveTextContent('First song'),
    )
  },
}

export const YoutubeItemShowsItsFrameHost: StoryObj<typeof YoutubeDemo> = {
  render: () => <YoutubeDemo failScript={false} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load youtube then a song' }))
    await expect(await canvas.findByRole('region', { name: 'Now playing' })).toHaveTextContent(
      'A youtube clip',
    )
  },
}
