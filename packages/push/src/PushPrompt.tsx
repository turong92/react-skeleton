import { Alert, Button } from '@skeleton/ui'
import { useMemo, useReducer, useSyncExternalStore } from 'react'
import { usePush, usePushConfig, type PushOptions } from './hooks'
import { resolvePushLabels, type PushLabelsInput } from './labels'
import type { PushApi } from './pushApi'
import { isPromptSnoozed, snoozePrompt } from './pushClient'
import { browserPushStorage } from './storage'

export type PushPromptProps = PushOptions & {
  api: PushApi
  /** 띠를 언제 띄울지는 앱이 정한다(예: 첫 노트를 저장한 뒤). 기본 true */
  open?: boolean
  /** 「나중에」 뒤 쉬는 날수 */
  snoozeDays?: number
  labels?: PushLabelsInput
}

/**
 * 앱 안 띠(soft ask) — 브라우저 권한 창을 바로 띄우지 않고 먼저 이유를 보여 준다.
 * 푸시를 쓸 수 있고(`supported`) 아직 권한을 묻지 않았고(`default`) 쉬는 중이 아니고 서버가 웹 푸시를 켰을 때만 보인다.
 * 「알림 받기」를 누르면 그 클릭 안에서 권한을 묻고, 거절하면 띠는 사라지며 다시 묻지 않는다.
 */
export function PushPrompt({
  api,
  open = true,
  snoozeDays = 14,
  labels,
  ...options
}: PushPromptProps) {
  const all = useMemo(() => resolvePushLabels(labels), [labels])
  const push = usePush(api, options)
  const config = usePushConfig(api)
  const store = useMemo(() => options.storage ?? browserPushStorage(), [options.storage])
  // 저장소는 브라우저에서만 읽는다 — 서버 렌더와 첫 그림은 「모름」이라 숨긴 채로 같다
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const snoozed = useSyncExternalStore(
    () => () => undefined,
    () => (isPromptSnoozed(store, options.accountId) ? 'snoozed' : 'awake'),
    () => 'unknown',
  )

  if (!open || snoozed !== 'awake') return null
  if (push.support !== 'supported' || push.permission !== 'default') return null
  if (!config.data?.webPush) return null
  return (
    <Alert
      tone="info"
      title={all.prompt.title}
      action={
        <>
          <Button size="sm" loading={push.busy} onClick={() => void push.enable()}>
            {all.prompt.enable}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={push.busy}
            onClick={() => {
              snoozePrompt(store, options.accountId, snoozeDays)
              rerender()
            }}
          >
            {all.prompt.later}
          </Button>
        </>
      }
    >
      {push.failed ? all.settings.enableFailed : all.prompt.description}
    </Alert>
  )
}
