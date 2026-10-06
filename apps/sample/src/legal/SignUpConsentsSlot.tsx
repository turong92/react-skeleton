import type { ConsentSlotApi } from '@skeleton/auth'
import { SignUpConsents } from '@skeleton/legal'
import { legalApi } from '../api/legal'
import { useLegalLocale } from './useLegalLocale'

/** 가입 폼의 동의 자리 — 서버 문서 목록으로 체크박스(서버에 legal 모듈이 없으면 비어 있고 가입을 막지 않는다) */
export function SignUpConsentsSlot({ slot }: { slot: ConsentSlotApi }) {
  const { locale, formatLocale, labels } = useLegalLocale()
  return (
    <SignUpConsents
      api={legalApi}
      slot={slot}
      locale={locale}
      fallbackLocale="ko"
      formatLocale={formatLocale}
      labels={labels}
    />
  )
}
