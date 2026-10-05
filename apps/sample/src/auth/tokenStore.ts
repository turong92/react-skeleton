import { createTokenStore } from '@skeleton/auth'
import { browserTokenStorage } from './storage'

export const tokenStore = createTokenStore({ storage: browserTokenStorage() })
