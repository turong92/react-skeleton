export const ACCOUNT_PATH = '/account'
/** 계정 설정과 그 제공자 콜백(`/account/link-callback`) — 이메일을 등록하거나 아이디를 정하거나 계정을 지우는 길이라 막을 걷는다. `/account-deleted` 는 해당 없다 */
export const onAccountPages = (pathname: string) =>
  pathname === ACCOUNT_PATH || pathname.startsWith(`${ACCOUNT_PATH}/`)

/** 「나중에 하기」로 닫았거나 막이 걷힌 화면에서 쓰기 단추를 눌렀다 - 붙잡은 쓰기는 403 으로 끝났고 전역 토스트는 이 코드를 거르므로, 아무 말 없이 실패하지 않게 한 줄로 알린다. 같은 id 라 여러 번 눌러도 한 줄이다 */
export const DECLINED_TOAST_ID = 'email-required-declined'
