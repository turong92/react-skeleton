import type { WorkspaceSummary } from './types'

/** `localStorage` 의 쓰는 부분만 — 시험 · 서버 렌더에서 가짜로 갈아 끼운다 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

const PREFIX = 'skeleton.workspace:last:'

/**
 * 브라우저의 `localStorage` — 접근만으로 던지는 환경과 서버 렌더에서는 undefined.
 * 모듈을 불러올 때가 아니라 부를 때 읽는다(SSR 안전)
 */
export function browserLocalStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** 이 기기가 기억하는 「마지막에 쓴 팀(slug)」 — 첫 화면으로 보낼 때만 쓰고, 주소에 `/w/<slug>` 가 있으면 읽지 않는다 */
export type LastWorkspaceMemory = {
  read(): string | undefined
  write(slug: string): void
  clear(): void
}

/** 계정마다 따로 — 저장소가 없거나 던져도 조용히 넘어간다(기억은 편의일 뿐이다) */
export function createLastWorkspaceMemory(
  storage: StorageLike | undefined,
  accountId: string,
): LastWorkspaceMemory {
  const key = `${PREFIX}${encodeURIComponent(accountId)}`
  return {
    read: () => {
      try {
        return storage?.getItem(key) ?? undefined
      } catch {
        return undefined
      }
    },
    write: (slug) => {
      try {
        storage?.setItem(key, slug)
      } catch {
        // 기억은 편의일 뿐이다
      }
    },
    clear: () => {
      try {
        storage?.removeItem(key)
      } catch {
        // 기억은 편의일 뿐이다
      }
    },
  }
}

/** 로그아웃 때 — 이 모듈이 쓴 기억을 모든 계정만큼 지운다(기기를 같이 쓰는 사람에게 남기지 않는다). 다른 키는 건드리지 않는다 */
export function forgetLastWorkspace(storage: StorageLike | undefined): void {
  try {
    if (!storage) return
    const mine: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key?.startsWith(PREFIX)) mine.push(key)
    }
    for (const key of mine) storage.removeItem(key)
  } catch {
    // 기억은 편의일 뿐이다
  }
}

/** 첫 화면에서 열 팀 — 기억한 팀이 아직 내 목록에 있으면 그것, 아니면 첫 팀, 팀이 없으면 undefined(만들기 화면) */
export function pickLandingSlug(
  workspaces: readonly Pick<WorkspaceSummary, 'slug'>[],
  remembered: string | undefined,
): string | undefined {
  if (remembered && workspaces.some((w) => w.slug === remembered)) return remembered
  return workspaces[0]?.slug
}
