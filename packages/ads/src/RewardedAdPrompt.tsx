import { Button, Dialog } from '@skeleton/ui'
import type { ReactNode } from 'react'
import type { useRewardedAd } from './useRewardedAd'

export type RewardedAdPromptProps = {
  ad: ReturnType<typeof useRewardedAd>
  /** 받을 보상 — 광고를 보기 전에 미리 알린다(구글 정책) */
  reward: ReactNode
  title?: string
  watchLabel?: string
  cancelLabel?: string
}

/**
 * 광고가 준비되면(`ready`) 뜨는 동의 창. 소리는 [Watch] 를 누른 손짓 안에서만 난다 — 준비 신호는 첫 클릭보다 늦게 와서
 * 그때는 브라우저의 일시적 사용자 활성이 끝나 있을 수 있기 때문이다. 닫기(× · Esc)는 「나중에」와 같다.
 */
export function RewardedAdPrompt({
  ad,
  reward,
  title = 'Watch an ad to get your reward?',
  watchLabel = 'Watch',
  cancelLabel = 'Not now',
}: RewardedAdPromptProps) {
  if (ad.status !== 'ready') return null
  return (
    <Dialog
      open
      onClose={ad.cancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={ad.cancel}>
            {cancelLabel}
          </Button>
          <Button onClick={ad.watch}>{watchLabel}</Button>
        </>
      }
    >
      <div>{reward}</div>
    </Dialog>
  )
}
