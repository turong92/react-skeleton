/** 키 상태 - 서버가 만료 시각 · 회수 시각으로 계산해 준다 */
export type ApiKeyStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED'

/** 누가 회수했나 - `OPERATOR` 면 화면이 「운영자가 회수」를 보인다(사유는 주인에게 주지 않는다) */
export type ApiKeyRevoker = 'USER' | 'OPERATOR'

/** 내 키 한 줄 - 토큰 · 해시는 오지 않는다(`hint` 는 알아볼 수 있는 끝 몇 글자) */
export type ApiKey = {
  id: string
  name: string
  hint: string
  scopes: string[]
  status: ApiKeyStatus
  revokedBy: ApiKeyRevoker | null
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
}

/** 선언된 범위 한 줄 - 앱 · 모듈이 `@ApiKeyScope` 로 선언한 것만 온다 */
export type ApiKeyScope = { key: string; module: string }

/** 발급 응답 - `token` 은 이 응답에만 있다(다시 볼 수 없다) */
export type CreatedApiKey = { key: ApiKey; token: string }

/** 운영자 목록의 한 줄 - 주인 id 가 더 있다. `ownerName` 은 `account.read` 도 가진 운영자에게만 온다 */
export type AdminApiKey = ApiKey & {
  ownerId: string
  ownerName?: string | null
  /** 운영자가 회수할 때 적은 사유 - 운영자에게만 온다(주인의 목록에는 없다) */
  revokedReason?: string | null
}
