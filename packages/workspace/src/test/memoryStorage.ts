import type { StorageLike } from '../lastWorkspace'

/** 메모리 안의 가짜 `localStorage` (시험 · 스토리용) */
export function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  }
}
