import type { CodeSent, SocialReauth } from '../account/accountApi'
import type { AuthLabels } from './labels'

export type Step = 'idle' | 'entering' | 'code'

export type ContactEmailSectionProps = {
  /** 확인된 연락받을 이메일(없으면 null) — `me.contactEmail` */
  contactEmail: string | null
  /** `POST /account/contact-email { email }` → 202. 인증번호가 그 주소로 간다(다시 인증 없음 · 남의 주소도 받는다) */
  onRequestCode: (email: string, reauth?: { socialReauth: SocialReauth }) => Promise<CodeSent>
  /** `POST /account/contact-email/confirm { code }` */
  onConfirmCode: (code: string) => Promise<unknown>
  /** `DELETE /account/contact-email` */
  onRemove: () => Promise<unknown>
  /** 등록 · 바꿈 · 지움이 끝났다 — 부모가 `me` 를 다시 읽는다 */
  onChanged?: () => void
  /** 계정 이메일이 없는 계정(이메일을 필수로 켜지 않은 앱)은 요청에 제공자 재동의가 든다 - 계정에 연결된 앱이 켠 제공자들 */
  providers?: string[]
  /** 재동의 단추 - 그 제공자의 동의 화면으로 보낸다(하려던 새 주소와 함께) */
  onProviderReauth?: (provider: string, email: string) => void
  /** 제공자 동의를 마치고 돌아왔다 - 새 주소와 그 증명으로 요청을 한 번 내고 코드 단계를 연다 */
  resume?: { email: string; socialReauth: SocialReauth } | null
  labels?: Partial<AuthLabels>
}
