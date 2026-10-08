import { createEmailRequiredController } from '@skeleton/auth'

/*
 * 이메일 등록 강제 — API 클라이언트가 403 `ACCOUNT.EMAIL_REQUIRED` 를 이 컨트롤러에 넘기고(`recoverForbidden`), `<EmailRequiredGate>`(main.tsx)가 「이메일을 등록해 주세요」 화면으로 앱을 덮는다.
 * 컨트롤러는 클라이언트보다 먼저 있어야 한다. 백엔드가 `email.required` 를 켜지 않았으면 이 403 도 `me.emailRequired` 도 오지 않아 아무 일도 일어나지 않는다.
 */
export const emailRequired = createEmailRequiredController()
