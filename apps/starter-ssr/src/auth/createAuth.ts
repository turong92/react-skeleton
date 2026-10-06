import {
  createAuthSession,
  createRefreshStore,
  createTokenStore,
  DEFAULT_REFRESH_STORAGE_KEY,
  type RefreshDelivery,
  type RefreshStore,
  DEFAULT_TOKEN_STORAGE_KEY,
  type AuthApi,
  type AuthSession,
  type SessionRefresher,
  type TokenStorage,
  type TokenStore,
} from '@skeleton/auth'

export type DeferredTokensOptions = {
  /** 브라우저의 저장소(`localStorage` 등). 서버에서는 주지 않는다 — 토큰은 브라우저에만 있다 */
  storage?: TokenStorage
  storageKey?: string
  /** 리프레시 자격의 저장 키(기본 `skeleton.refresh`) — 앱 이름공간(`authStorageKeys(ns).refresh`) */
  refreshStorageKey?: string
}

export type DeferredTokens = {
  /** API 클라이언트의 `getAuthHeaders` · 401 처리와 세션이 같이 쓴다 */
  store: TokenStore
  /** 리프레시 토큰(또는 쿠키 모드의 표식)도 같은 방식 — 생성할 때 읽지 않고 `restore()` 가 올린다 */
  refreshStore: RefreshStore
  /** 하이드레이션이 끝난 뒤(effect) 한 번 — 저장소의 토큰을 올린다 */
  restore(): void
  /** 저장소를 읽어 올렸는가(갱신이 끝나기를 기다리지 않는다) */
  isRestored(): boolean
  /** 갱신까지 끝나 가드가 판단해도 되는 순간 — `Auth.restore()` 가 부른다 */
  markRestored(): void
  subscribeRestored(listener: () => void): () => void
}

/**
 * 서버 렌더와 하이드레이션 첫 그림은 「로그인 안 한 상태」여야 같은 HTML 이 나온다(서버는 브라우저의 토큰을 모른다).
 * 그래서 토큰 저장소는 **읽기를 미루고**(생성할 때 읽지 않는다) 쓰기만 즉시 한다 — `restore()` 가 하이드레이션이 끝난 뒤에 읽어 올린다.
 * 그 전까지 `isRestored()` 는 false 라 보호 라우트는 중립 자리 표시를 그린다(`ClientRequireAuth`).
 */
export function createDeferredTokens({
  storage,
  storageKey = DEFAULT_TOKEN_STORAGE_KEY,
  refreshStorageKey = DEFAULT_REFRESH_STORAGE_KEY,
}: DeferredTokensOptions = {}): DeferredTokens {
  let readable = false // 저장소를 읽어도 되는가
  let restored = false // 가드가 판단해도 되는가
  // 복원 전에는 읽기를 막는다(null) — 복원 뒤에는 진짜 저장소를 읽는다(다른 탭이 갱신했는지 `reload()` 가 볼 수 있게)
  const writeOnly: TokenStorage | undefined = storage && {
    getItem: (key) => (readable ? storage.getItem(key) : null),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
  }
  const store = createTokenStore({ storage: writeOnly, storageKey, crossTab: true })
  const refreshStore = createRefreshStore({
    storage: writeOnly,
    storageKey: refreshStorageKey,
    crossTab: true,
  })
  const listeners = new Set<() => void>()

  return {
    store,
    refreshStore,
    restore() {
      if (readable) return
      try {
        const token = storage?.getItem(storageKey)
        const refresh = storage?.getItem(refreshStorageKey)
        if (refresh) refreshStore.set(JSON.parse(refresh))
        if (token) store.set(token)
      } catch {
        // 저장소가 막혔다 — 메모리만 쓴다
      }
      readable = true
    },
    markRestored() {
      if (restored) return
      restored = true
      listeners.forEach((listener) => listener())
    },
    isRestored: () => restored,
    subscribeRestored(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type Auth = Omit<DeferredTokens, 'store' | 'refreshStore' | 'markRestored'> & { session: AuthSession }

/** 세션 + 복원 상태. 화면은 `useAuth()` 로 세션을, `useSessionRestored()` 로 복원 여부를 읽는다 */
export function createAuth({
  api,
  tokens,
  delivery = 'body',
  refresher,
}: {
  api: AuthApi
  tokens: DeferredTokens
  delivery?: RefreshDelivery
  /** 앱이 `recoverUnauthorized` 에 꽂은 갱신기 — `restore()` 도 같은 한 줄을 거친다 */
  refresher?: SessionRefresher
}): Auth {
  const session = createAuthSession({
    api,
    store: tokens.store,
    refreshStore: tokens.refreshStore,
    delivery,
    refresher,
  })
  return {
    session,
    restore() {
      tokens.restore()
      // 액세스 토큰이 없고 갱신 자격만 남았으면(쿠키 모드 · 탭 간) 되살린다 — 가드는 그 갱신이 끝난 뒤에야 판단한다(그 전에 로그인으로 보내지 않는다)
      const needsRefresh = tokens.store.get() === null && tokens.refreshStore.get() !== null
      if (!needsRefresh) {
        tokens.markRestored()
        return
      }
      void session
        .restore()
        .catch(() => undefined)
        .finally(() => tokens.markRestored())
    },
    isRestored: tokens.isRestored,
    subscribeRestored: tokens.subscribeRestored,
  }
}
