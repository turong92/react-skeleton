import type { LoginIdRules } from '../account/loginIdRules'
import type { LoginIdRequiredController } from '../loginIdRequired'

/**
 * 계정 페이지가 설정 화면에 건네는 아이디 쪽 연결 - 이메일의 `onEmailRegistered` 와 같은 길이다.
 * `loginIdRequired`(막의 컨트롤러)가 있으면 설정에서 정한 뒤 막을 접고 붙잡힌 호출을 푼다. 발견이 길이 규칙을 줬으면 안내 문구와 판정이 서버의 규칙을 따른다.
 */
export function loginIdSettingsProps(ctx: {
  loginIdRequired?: LoginIdRequiredController
  loginId?: LoginIdRules
}): { loginIdRules?: LoginIdRules; onLoginIdChosen?: () => void } {
  const { loginIdRequired, loginId } = ctx
  return {
    ...(loginId ? { loginIdRules: loginId } : {}),
    ...(loginIdRequired ? { onLoginIdChosen: () => loginIdRequired.chosen() } : {}),
  }
}
