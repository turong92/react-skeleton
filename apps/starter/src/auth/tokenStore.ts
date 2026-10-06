import { createRefreshStore, createTokenStore } from '@skeleton/auth'
import { browserTokenStorage } from './storage'

// crossTab: 같은 저장소를 쓰는 다른 탭의 로그인 · 로그아웃 · 갱신을 따라간다(저장소가 sessionStorage 면 탭마다 따로라 할 일이 없다)
export const tokenStore = createTokenStore({ storage: browserTokenStorage(), crossTab: true })
export const refreshStore = createRefreshStore({ storage: browserTokenStorage(), crossTab: true })
