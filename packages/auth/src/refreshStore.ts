import { listenToOtherTabs, type CrossTabOption } from './crossTab'
import type { TokenStorage } from './tokenStore'

/**
 * 갱신 자격. `body` 모드는 `refreshToken` 을 쥔다(로그인 · 갱신마다 새 것으로 바뀐다). `cookie` 모드는 토큰이 HttpOnly 쿠키라
 * JS 가 못 보므로 `refreshToken` 은 null 이고 「로그인해 있다」는 표식(`sessionId`)만 남긴다.
 */
export type RefreshCredentials = {
  refreshToken: string | null
  refreshExpiresAt?: string
  sessionId?: string
}

export type RefreshStore = {
  get(): RefreshCredentials | null
  set(credentials: RefreshCredentials): void
  clear(): void
  subscribe(listener: () => void): () => void
  reload(): void
}

export type RefreshStoreOptions = {
  /** 없으면 메모리만 — 새로고침하면 사라진다. `sessionStorage`(탭마다 따로 로그인) 또는 `localStorage`(탭 공유 · `crossTab` 과 함께) */
  storage?: TokenStorage
  storageKey?: string
  crossTab?: CrossTabOption
}

export const DEFAULT_REFRESH_STORAGE_KEY = 'skeleton.refresh'

/** 리프레시 토큰(또는 쿠키 모드의 표식) 저장소. 저장소가 막히거나 값이 깨져 있어도 메모리로 계속 동작한다 */
export function createRefreshStore({
  storage,
  storageKey = DEFAULT_REFRESH_STORAGE_KEY,
  crossTab,
}: RefreshStoreOptions = {}): RefreshStore {
  const listeners = new Set<() => void>()
  let current = read(storage, storageKey)

  function update(next: RefreshCredentials | null) {
    if (JSON.stringify(next) === JSON.stringify(current)) return
    current = next
    write(storage, storageKey, next)
    listeners.forEach((listener) => listener())
  }

  function reload() {
    if (!storage) return
    const persisted = read(storage, storageKey)
    if (JSON.stringify(persisted) === JSON.stringify(current)) return
    current = persisted
    listeners.forEach((listener) => listener())
  }
  if (storage) listenToOtherTabs(crossTab, storageKey, reload)

  return {
    reload,
    get: () => current,
    set: (credentials) => update(credentials),
    clear: () => update(null),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function read(storage: TokenStorage | undefined, key: string): RefreshCredentials | null {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as RefreshCredentials
  } catch {
    return null
  }
}

function write(storage: TokenStorage | undefined, key: string, value: RefreshCredentials | null) {
  try {
    if (value === null) storage?.removeItem(key)
    else storage?.setItem(key, JSON.stringify(value))
  } catch {
    // 저장만 못 한다
  }
}
