/** `localStorage` 의 쓰는 부분만 — 시험 · 서버 렌더에서 가짜로 갈아 끼운다 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

/** 이 기기가 기억하는 「게시판별 마지막으로 쓴 프로필」 */
export type AuthorMemory = {
  /** 이 게시판에서 마지막으로 고른 프로필 id — 없거나 저장소를 못 읽으면 undefined */
  get(boardCode: string): string | undefined
  /** 기억한다(`undefined` 면 이 게시판 기억을 지운다). 저장소 오류는 삼킨다 */
  set(boardCode: string, profileId: string | undefined): void
  /** 로그아웃 때 — 이 모듈이 쓴 것을 **모든 계정 · 모든 게시판** 만큼 지운다(기기를 같이 쓰는 사람에게 남기지 않는다). 다른 저장 값은 건드리지 않는다 */
  forget(): void
}

const PREFIX = 'skeleton.author-profile:'

/**
 * 브라우저의 `localStorage` — 접근만으로 던지는 환경(차단 · 일부 사생활 보호 창)과 서버 렌더에서는 undefined.
 * 모듈을 불러올 때가 아니라 부를 때 읽는다(SSR 안전).
 */
export function browserLocalStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/**
 * 이 모듈이 쓴 기억을 **모든 계정 · 모든 게시판** 만큼 지운다 — 계정 id 를 모르고 저장소만으로 부른다(로그아웃 · 계정 바뀜 핸들러는 이전 계정 id 를 이미 잃었을 수 있다).
 * 다른 저장 값은 건드리지 않는다. 저장소가 없거나 던지면 조용히 넘어간다.
 */
export function forgetAuthorMemory(storage: StorageLike | undefined): void {
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

/** 이 모듈의 키 중 `accountId` 의 것이 아닌 것을 지운다 — 기기를 같이 쓴 이전 계정의 기억이 남지 않게(만들 때마다 한 번) */
function forgetOtherAccounts(storage: StorageLike | undefined, accountId: string): void {
  try {
    if (!storage) return
    const own = `${PREFIX}${encodeURIComponent(accountId)}:`
    const others: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key?.startsWith(PREFIX) && !key.startsWith(own)) others.push(key)
    }
    for (const key of others) storage.removeItem(key)
  } catch {
    // 기억은 편의일 뿐이다
  }
}

/**
 * 기기 기억 — `localStorage` 한 겹. 키 `skeleton.author-profile:<계정 id>:<게시판 코드>`(둘 다 인코딩) 의 **키에만** 계정 id 가 있고(화면에는 어디에도 없다),
 * 값은 프로필 id 하나뿐이다. **만들 때 이 모듈이 쓴 다른 계정의 키를 지운다**(기기에는 현재 계정의 것만 남는다 — 그래서 계정 id 를 아는 로그인 뒤에 만든다).
 * 저장소가 없거나 던지면 아무것도 기억하지 않고 조용히 넘어간다.
 */
export function createAuthorMemory(
  storage: StorageLike | undefined,
  accountId: string,
): AuthorMemory {
  forgetOtherAccounts(storage, accountId)
  const keyOf = (boardCode: string) =>
    `${PREFIX}${encodeURIComponent(accountId)}:${encodeURIComponent(boardCode)}`
  return {
    get(boardCode) {
      try {
        return storage?.getItem(keyOf(boardCode)) ?? undefined
      } catch {
        return undefined
      }
    },
    set(boardCode, profileId) {
      try {
        if (profileId === undefined) storage?.removeItem(keyOf(boardCode))
        else storage?.setItem(keyOf(boardCode), profileId)
      } catch {
        // 가득 찼거나 막힌 저장소 — 기억은 편의일 뿐이다
      }
    },
    forget: () => forgetAuthorMemory(storage),
  }
}
