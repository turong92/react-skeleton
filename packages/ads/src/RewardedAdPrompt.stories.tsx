import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { expect, screen, within } from 'storybook/test'
import { createFakeGoogletag } from './fakeGoogletag'
import type { FakeRewardedOutcome } from './fakeGoogletag'
import { RewardedAdPrompt } from './RewardedAdPrompt'
import { createFakeWebRewardedApi } from './stories/fakeWebRewardedApi'
import { useRewardedAd } from './useRewardedAd'

/**
 * 보상형 광고 동의 창. 정본 사용법: 앱의 「광고 보고 …」 버튼이 `ad.start()` 를 부르고, `<RewardedAdPrompt ad={ad} reward="…" />` 를
 * 한 번 둔다. 광고가 준비되면(`ready`) 받을 보상을 적은 창이 뜨고, 소리는 [Watch] 를 누른 뒤에만 난다.
 * `rewarded` 가 되면 앱이 자기 쿼리를 무효화한다(포인트 · 사용권).
 * 이 스토리는 진짜 GPT 대신 가짜 googletag(미디어 없음, 소리 없음)와 가짜 서버를 꽂는다 — 앱은 로컬 · 시험에서만 그렇게 한다.
 */
function Demo({ outcome }: { outcome: FakeRewardedOutcome }) {
  const api = useMemo(() => createFakeWebRewardedApi(), [])
  const loader = useMemo(() => createFakeGoogletag({ outcome, watchMs: 50 }).loader, [outcome])
  const ad = useRewardedAd({
    api,
    adUnitPath: '/1234567/rewarded',
    purpose: 'unlock-episode',
    loadGoogletag: loader,
    // 스토리의 합성 클릭은 브라우저의 사용자 활성을 만들지 않는다 — 실제 사람의 클릭에서는 기본값(`navigator.userActivation`)이 쓰인다
    isUserActive: () => true,
  })
  return (
    <>
      <Button onClick={ad.start} disabled={ad.status !== 'idle'}>
        Watch an ad for 10 points
      </Button>
      <p role="status">Status: {ad.status}</p>
      {ad.status === 'rewarded' && <p>Reward received</p>}
      {ad.status === 'forfeited' && <p>The ad was closed early, no reward</p>}
      {ad.status === 'unavailable' && <p>No ad available right now</p>}
      <RewardedAdPrompt ad={ad} reward="Watch a short ad to get 10 points." />
    </>
  )
}

const meta = {
  title: 'Packages/ads/RewardedAdPrompt',
  component: RewardedAdPrompt,
  args: {
    ad: { status: 'idle', start: () => undefined, watch: () => undefined, cancel: () => undefined },
    reward: '',
  },
} satisfies Meta<typeof RewardedAdPrompt>
export default meta
type Story = StoryObj<typeof meta>

export const ConsentWatchAndReward: Story = {
  render: () => <Demo outcome="granted" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Watch an ad for 10 points' }))
    // 모달이 열리면 배경은 비활성이 되어 역할 조회에서 빠진다 — 창은 screen 에서 찾는다
    const dialog = await screen.findByRole('dialog')
    await expect(dialog).toHaveTextContent('Watch a short ad to get 10 points.')
    // 보기 전에는 아무 일도 없다 — 손짓(클릭) 뒤에만 광고가 나간다
    await expect(canvas.getByText('Status: ready')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Watch' }))
    await expect(await canvas.findByText('Reward received')).toBeInTheDocument()
  },
}

export const NotNowGoesBackToIdle: Story = {
  render: () => <Demo outcome="granted" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Watch an ad for 10 points' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Not now' }))
    await expect(await canvas.findByText('Status: idle')).toBeInTheDocument()
  },
}

export const ClosedEarlyForfeitsTheReward: Story = {
  render: () => <Demo outcome="closed" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Watch an ad for 10 points' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Watch' }))
    await expect(await canvas.findByText('The ad was closed early, no reward')).toBeInTheDocument()
  },
}

export const NoAdAvailable: Story = {
  render: () => <Demo outcome="no-fill" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Watch an ad for 10 points' }))
    await expect(await canvas.findByText('No ad available right now')).toBeInTheDocument()
  },
}
