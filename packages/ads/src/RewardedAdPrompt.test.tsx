import { Button } from '@skeleton/ui'
import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RewardedAdPrompt } from './RewardedAdPrompt'
import type { RewardedAdPromptProps } from './RewardedAdPrompt'
import { useRewardedAd } from './useRewardedAd'

type Ad = RewardedAdPromptProps['ad']
const adIn = (status: Ad['status']): Ad => ({
  status,
  start: vi.fn(),
  watch: vi.fn(),
  cancel: vi.fn(),
})

/** 이 테스트 환경에는 DOM 이 없다 — 컴포넌트가 돌려준 요소 나무에서 `Button` 의 onClick 을 찾아 부른다(실제 클릭은 스토리 play 가 본다) */
function buttons(node: ReactNode, found: Array<{ label: unknown; onClick?: () => void }> = []) {
  if (Array.isArray(node)) node.forEach((child) => buttons(child, found))
  else if (
    isValidElement<{ children?: ReactNode; footer?: ReactNode; onClick?: () => void }>(node)
  ) {
    if (node.type === Button)
      found.push({ label: node.props.children, onClick: node.props.onClick })
    buttons(node.props.children, found)
    buttons(node.props.footer, found)
  }
  return found
}

describe('RewardedAdPrompt', () => {
  it.each(['idle', 'opening', 'loading', 'playing', 'granting', 'rewarded'] as const)(
    'draws nothing while the ad is %s (the consent window is only for ready)',
    (status) => {
      expect(renderToStaticMarkup(<RewardedAdPrompt ad={adIn(status)} reward="10 points" />)).toBe(
        '',
      )
    },
  )

  it('when ready shows the reward and plays only from the Watch click; Not now cancels', () => {
    const ad = adIn('ready')
    const element = RewardedAdPrompt({ ad, reward: '10 points' })
    expect(renderToStaticMarkup(<RewardedAdPrompt ad={ad} reward="10 points" />)).toContain(
      '10 points',
    )
    expect(ad.watch).not.toHaveBeenCalled()
    const all = buttons(element)
    const watch = all.find((b) => b.label === 'Watch')!
    const cancel = all.find((b) => b.label === 'Not now')!
    watch.onClick!()
    expect(ad.watch).toHaveBeenCalledTimes(1)
    expect(ad.cancel).not.toHaveBeenCalled()
    cancel.onClick!()
    expect(ad.cancel).toHaveBeenCalledTimes(1)
  })
})

describe('useRewardedAd', () => {
  it('server-renders as idle and loads nothing (the controller starts in an effect)', () => {
    const loadGoogletag = vi.fn()
    const api = { openSession: vi.fn(), grant: vi.fn() }
    function Probe() {
      const ad = useRewardedAd({ api, adUnitPath: '/1/x', purpose: 'p', loadGoogletag })
      return <output>{ad.status}</output>
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('<output>idle</output>')
    expect(loadGoogletag).not.toHaveBeenCalled()
    expect(api.openSession).not.toHaveBeenCalled()
  })
})
