import { createRefreshStore, createTokenStore } from '@skeleton/auth'
import { browserTokenStorage } from './storage'

export const tokenStore = createTokenStore({ storage: browserTokenStorage(), crossTab: true })
export const refreshStore = createRefreshStore({ storage: browserTokenStorage(), crossTab: true })
