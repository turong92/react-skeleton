/**
 * 광고 푸시 화면(`AdvertisingSettings`)이 동의문을 보여 주고 따로 받는 문서 — 가입 「전체 동의」 · 계정 설정의 약관 스위치로는 받지 않는다.
 * 야간(21~08시) 동의는 광고 수신에 동의한 사람만, 동의문을 읽고 체크한 뒤에만 기록되어야 한다.
 */
export const AD_OWNED_TYPES = ['marketing-night'] as const
