/** 백엔드 `payment` 모듈이 선언한 권한 이름 - 환불 승인 · 거절 · 직접 환불 = `refund`, 결제사와 맞추기 · 닫기 · 웹훅 다시 처리 = `operate` */
export const PAYMENT_PERMISSIONS = {
  read: 'payment.read',
  refund: 'payment.refund',
  operate: 'payment.operate',
} as const

/** 부품이 받는 권한 질문 - 주지 않으면 모두 true(권한을 모르는 기존 앱은 그대로). 서버가 다시 판정하니 화면은 숨길 뿐이다 */
export type CanFn = (key: string) => boolean

export const allowAll: CanFn = () => true

/** 백엔드 `catalog` 모듈이 선언한 권한 이름 - 기본 역할 없이 전권만 갖는다. 상품 · 가격을 만들고 고치고 멈추는 모든 운영 행동 */
export const CATALOG_PERMISSIONS = { manage: 'catalog.manage' } as const
