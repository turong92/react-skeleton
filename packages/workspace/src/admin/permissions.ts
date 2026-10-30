/** 백엔드 모듈이 선언한 운영 권한(기본 역할 없음 - 전권만) */
export const WORKSPACE_PERMISSIONS = { read: 'workspace.read' } as const

/** 부품이 받는 권한 질문 - 주지 않으면 모두 true. 서버가 다시 판정하니 화면은 가릴 뿐이다 */
export type CanFn = (key: string) => boolean
export const allowAll: CanFn = () => true
