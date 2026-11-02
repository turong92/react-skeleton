export type ObjectUrls = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>

type Shown = { file: File | null; url: string | null }

/**
 * 로컬 미리보기 한 칸의 상태 기계 — `show(file)` 이 이미지면 object URL 을 만들어 돌려주고, 이전 것은 `revoke` 한다.
 * `useFilePreview` 가 이것을 외부 저장소(`subscribe` · `getSnapshot`)로 읽는다(React 없이 시험하려고 나눴다).
 */
export function createFilePreview(urls: ObjectUrls = URL) {
  let current: Shown = { file: null, url: null }
  const listeners = new Set<() => void>()
  const set = (next: Shown) => {
    if (current.url !== null) urls.revokeObjectURL(current.url)
    current = next
    listeners.forEach((listener) => listener())
  }
  return {
    show(file: File | null): string | null {
      set({ file, url: file && file.type.startsWith('image/') ? urls.createObjectURL(file) : null })
      return current.url
    },
    dispose: () => set({ file: null, url: null }),
    getSnapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
