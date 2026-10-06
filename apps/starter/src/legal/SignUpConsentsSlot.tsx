import type { ConsentSlotApi } from '@skeleton/auth'
import { koLegalLabels, SignUpConsents } from '@skeleton/legal'
import { legalApi } from '../api/legal'

/** 가입 폼의 동의 자리 — 서버의 문서 목록으로 체크박스를 만든다(`createAuthRoutes({ signUp: { renderConsents } })`) */
export function SignUpConsentsSlot({ slot }: { slot: ConsentSlotApi }) {
  return <SignUpConsents api={legalApi} slot={slot} locale="ko" labels={koLegalLabels} />
}
