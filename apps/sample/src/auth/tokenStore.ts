import { createRefreshStore, createTokenStore } from '@skeleton/auth'
import { authKeys } from './authConfig'
import { browserTokenStorage } from './storage'

export const tokenStore = createTokenStore({
  storage: browserTokenStorage(),
  storageKey: authKeys.accessToken,
  crossTab: true,
})
export const refreshStore = createRefreshStore({
  storage: browserTokenStorage(),
  storageKey: authKeys.refresh,
  crossTab: true,
})
