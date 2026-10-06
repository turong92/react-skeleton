import type { ConsentSlotApi } from '@skeleton/auth'
import { koLegalLabels, SignUpConsents } from '@skeleton/legal'
import { useLegalApi } from './useLegalApi'

/** 가입 폼의 동의 자리 — 서버의 문서 목록으로 체크박스(legal 모듈이 없는 백엔드면 비어 있고 가입을 막지 않는다) */
export function SignUpConsentsSlot({ slot }: { slot: ConsentSlotApi }) {
  return <SignUpConsents api={useLegalApi()} slot={slot} locale="ko" labels={koLegalLabels} />
}
