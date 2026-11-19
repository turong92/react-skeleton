import { createMfaEnrollmentRequiredController } from '@skeleton/auth'

/*
 * 2단계 인증 등록 강제 - 이 견본은 운영 권한이 있는 계정(OPERATORS)에게 2단계를 필수로 건다. 백엔드가 등록 전 운영자의 허용 목록 밖 호출을 403 `MFA.ENROLLMENT_REQUIRED` 로 막으면
 * API 클라이언트가 이 컨트롤러에 넘기고(`recoverForbidden`), `<MfaGate>`(main.tsx)가 「2단계 인증을 켜 주세요」 화면으로 앱을 덮는다. 필수가 아닌 계정에는 이 403 이 오지 않아 아무 일도 없다.
 */
export const mfaEnrollmentRequired = createMfaEnrollmentRequiredController()
