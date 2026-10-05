export type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type TokenStore = {
  get(): string | null
  set(token: string): void
  clear(): void
  subscribe(listener: () => void): () => void
}

export type TokenStoreOptions = {
  /** 주면 토큰을 거기에도 쓴다(예: `localStorage`, `sessionStorage`). 없으면 메모리만 — 새로고침하면 로그아웃 */
  storage?: TokenStorage
  storageKey?: string
}

export const DEFAULT_TOKEN_STORAGE_KEY = 'skeleton.accessToken'

/** 토큰 저장소. 저장소가 막히거나 던져도 메모리로 계속 동작한다 */
export function createTokenStore({
  storage,
  storageKey = DEFAULT_TOKEN_STORAGE_KEY,
}: TokenStoreOptions = {}): TokenStore {
  const listeners = new Set<() => void>()
  let token: string | null = readPersisted(storage, storageKey)

  function update(next: string | null) {
    if (next === token) return
    token = next
    persist(storage, storageKey, next)
    listeners.forEach((listener) => listener())
  }

  return {
    get: () => token,
    set: (next) => update(next === '' ? null : next),
    clear: () => update(null),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function readPersisted(storage: TokenStorage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) || null
  } catch {
    return null
  }
}

function persist(storage: TokenStorage | undefined, key: string, token: string | null) {
  try {
    if (token === null) storage?.removeItem(key)
    else storage?.setItem(key, token)
  } catch {
    // 저장만 못 한다
  }
}
