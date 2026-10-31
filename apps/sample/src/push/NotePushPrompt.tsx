import { useAuth } from '@skeleton/auth'
import { koPushLabels, PushPrompt } from '@skeleton/push'
import { languageOf, useT } from '../i18n'
import { pushApi } from './api'

/** 노트를 처음 저장한 직후의 띠 — 권한 창은 「알림 받기」를 누를 때만 뜬다. 언제 보일지는 앱이 정한다(`open`) */
export function NotePushPrompt({ open }: { open: boolean }) {
  const { principal } = useAuth()
  const { locale } = useT()
  if (!open || !principal?.accountId) return null
  return (
    <PushPrompt
      api={pushApi}
      accountId={principal.accountId}
      labels={languageOf(locale) === 'ko' ? koPushLabels : undefined}
    />
  )
}
