import { listenToOtherTabs, type CrossTabOption } from './crossTab'

export type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type TokenStore = {
  get(): string | null
  set(token: string): void
  clear(): void
  subscribe(listener: () => void): () => void
  /** 저장소의 값을 다시 읽는다(바뀌었으면 구독자에게 알린다) — 다른 탭이 갱신했을 수 있는 순간(락 안)에 */
  reload(): void
}

export type TokenStoreOptions = {
  /** 주면 토큰을 거기에도 쓴다(예: `localStorage`, `sessionStorage`). 없으면 메모리만 — 새로고침하면 로그아웃 */
  storage?: TokenStorage
  storageKey?: string
  /** true 면 같은 저장소(`localStorage`)를 쓰는 다른 탭의 로그인 · 로그아웃 · 갱신을 따라간다(`storage` 이벤트). 서버에서는 아무 일도 안 한다 */
  crossTab?: CrossTabOption
}

export const DEFAULT_TOKEN_STORAGE_KEY = 'skeleton.accessToken'

/** 토큰 저장소. 저장소가 막히거나 던져도 메모리로 계속 동작한다 */
export function createTokenStore({
  storage,
  storageKey = DEFAULT_TOKEN_STORAGE_KEY,
  crossTab,
}: TokenStoreOptions = {}): TokenStore {
  const listeners = new Set<() => void>()
  let token: string | null = readPersisted(storage, storageKey)

  function update(next: string | null) {
    if (next === token) return
    token = next
    persist(storage, storageKey, next)
    listeners.forEach((listener) => listener())
  }

  function reload() {
    if (!storage) return // 메모리만이면 다시 읽을 곳이 없다
    const persisted = readPersisted(storage, storageKey)
    if (persisted === token) return
    token = persisted
    listeners.forEach((listener) => listener())
  }
  if (storage) listenToOtherTabs(crossTab, storageKey, reload)

  return {
    reload,
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
