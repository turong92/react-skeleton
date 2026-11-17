import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { loadGoogletag } from './googletag'
import { createRewardedAd, defaultIsUserActive } from './rewardedAd'
import type { RewardedAd, RewardedAdOptions, RewardedAdState } from './rewardedAd'

const IDLE: RewardedAdState = { status: 'idle' }
const noSubscription = () => () => undefined

/**
 * 보상형 광고 흐름을 컴포넌트에 연결한다. 컨트롤러는 effect 안에서 만들고 unmount 에 `destroy` 한다(서버 렌더는 `{ status: 'idle' }`).
 * `api` · `adUnitPath` · `purpose` 가 바뀌면 새로 만든다 — `api` 는 컴포넌트 밖이나 `useMemo` 에서 만든다.
 * `start()` 는 앱의 「광고 보고 …」 버튼에서만 부른다(자동 시작 금지).
 */
export function useRewardedAd(
  options: RewardedAdOptions,
): RewardedAdState & Pick<RewardedAd, 'start' | 'watch' | 'cancel'> {
  const { api, adUnitPath, purpose } = options
  // 함수 옵션은 매 렌더 새로 만들어도 컨트롤러를 갈아치우지 않도록 최신 것을 따라간다
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })
  const [ad, setAd] = useState<RewardedAd | null>(null)
  useEffect(() => {
    const created = createRewardedAd({
      api,
      adUnitPath,
      purpose,
      loadGoogletag: () => (latest.current.loadGoogletag ?? loadGoogletag)(),
      isUserActive: () => (latest.current.isUserActive ?? defaultIsUserActive)(),
    })
    setAd(created)
    return () => {
      created.destroy()
      setAd(null)
    }
  }, [api, adUnitPath, purpose])

  const state = useSyncExternalStore(
    ad ? ad.subscribe : noSubscription,
    () => ad?.getState() ?? IDLE,
    () => IDLE,
  )
  const start = useCallback(() => ad?.start(), [ad])
  const watch = useCallback(() => ad?.watch(), [ad])
  const cancel = useCallback(() => ad?.cancel(), [ad])
  return { ...state, start, watch, cancel }
}
