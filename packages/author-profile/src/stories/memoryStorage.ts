import type { StorageLike } from '../authorMemory'

/** 스토리용 메모리 저장소 — 시험이 안을 들여다보고(`dump`) 스토리마다 비운다(`reset`) */
export function createMemoryStorage(): StorageLike & {
  dump(): Record<string, string>
  reset(): void
} {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
    reset: () => map.clear(),
  }
}
