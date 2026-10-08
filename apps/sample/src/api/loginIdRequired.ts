import { createLoginIdRequiredController } from '@skeleton/auth'

/*
 * 아이디 정하기 강제 - API 클라이언트가 403 `ACCOUNT.LOGIN_ID_REQUIRED` 를 이 컨트롤러에 넘기고(`recoverForbidden`), `<LoginIdGate>`(main.tsx)가 「아이디를 정해 주세요」 화면으로 앱을 덮는다.
 * 컨트롤러는 클라이언트보다 먼저 있어야 한다. 백엔드가 `login-id.enabled` 를 켜지 않았으면 이 403 도 `me.loginId` 도 오지 않아 아무 일도 일어나지 않는다.
 * 서버 인터셉터의 순서가 아이디 → 이메일 → 약관이라 이 막이 가장 바깥이다.
 */
export const loginIdRequired = createLoginIdRequiredController()
