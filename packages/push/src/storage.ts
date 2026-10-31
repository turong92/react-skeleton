/** 브라우저 저장소 중 이 패키지가 쓰는 부분(`localStorage` 가 그대로 맞는다) */
export type PushStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** `localStorage` — 막혀 있거나(시크릿 창 · 차단) 서버에서는 읽기 null · 쓰기 무시로 둔다 */
export function browserPushStorage(): PushStorage {
  const real = (): Storage | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
      return null
    }
  }
  const guard = <T>(run: (s: Storage) => T, fallback: T): T => {
    try {
      const s = real()
      return s ? run(s) : fallback
    } catch {
      return fallback
    }
  }
  return {
    getItem: (key) => guard((s) => s.getItem(key), null),
    setItem: (key, value) => guard((s) => s.setItem(key, value), undefined),
    removeItem: (key) => guard((s) => s.removeItem(key), undefined),
  }
}
