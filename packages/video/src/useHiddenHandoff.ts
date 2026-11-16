import { useEffect, type Dispatch } from 'react'
import { watchHidden } from './autoAudio'
import type { PlayIntent } from './playIntent'
import type { Latest, MediaRefs, Report } from './playerRuntime'
import type { PlayerAction } from './playerState'

type Args = {
  /** 켜져 있고 영상으로 재생 중이며 소리 판이 있고, 소리 판 실패로 돌아온 직후가 아닐 때 */
  watching: boolean
  engine: 'native' | 'hlsjs' | null | undefined
  latest: React.RefObject<Latest>
  refs: MediaRefs
  intent: PlayIntent
  report: Report
  dispatch: Dispatch<PlayerAction>
}

/** 화면이 꺼지면 같은 시각의 소리 판으로 넘긴다(`autoAudioWhenHidden`). 폰이 소리 재생을 거절하면 멈춤으로 바로잡는다 */
export function useHiddenHandoff({
  watching,
  engine,
  latest,
  refs,
  intent,
  report,
  dispatch,
}: Args) {
  useEffect(() => {
    if (!watching || !engine) return
    return watchHidden({
      doc: document,
      intent,
      video: () => refs.video.current,
      audio: () => (refs.audio.current?.error ? null : refs.audio.current),
      audioUrl: () => latest.current.grant.audio,
      native: engine === 'native',
      onHandoff: ({ at, adopt }) => dispatch({ type: 'handoff', at, adopt }),
      onHandoffFailed: () => {
        dispatch({ type: 'paused' })
        report(false)
      },
    })
    // `latest` · `refs` · `dispatch` · `report` 는 늘 같은 것이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, engine, intent])
}
