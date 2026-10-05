/*
 * 동의 선택 저장소 — **순수 클라이언트 저장 + 구독 + onChange**. 추적 코드는 없다: 이 저장소는 사람이 무엇을 허용했는지만 기억하고,
 * 허용된 곳에서만 앱이 자기 분석 · 광고 코드를 켠다(`store.has('analytics')` 나 `onChange`).
 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type ConsentState = {
  /** `unknown` 은 서버(와 하이드레이션 첫 그림)의 값 — 방문자의 선택을 모른다. `undecided` 는 브라우저에서 아직 고르지 않음 */
  status: 'unknown' | 'undecided' | 'decided'
  /** 동의 문구 · 범주 버전 — 바뀌면 다시 묻는다 */
  version: string
  /** 범주 id → 허용 여부 */
  choices: Record<string, boolean>
  decidedAt?: string
}

export type ConsentStoreOptions = {
  /** 범주 id(예 `['necessary', 'analytics', 'marketing']`) */
  categories: string[]
  /** 항상 켜져 있어야 하는 범주(기본 `['necessary']`) — 끌 수 없다 */
  required?: string[]
  /** 문구 · 범주가 바뀔 때 올린다 — 이전 선택은 무효가 되어 다시 묻는다 */
  version: string
  storageKey?: string
  /** 기본은 브라우저의 `localStorage`(서버에서는 저장 없이 메모리만) */
  storage?: StorageLike
  now?: () => Date
  /** 사람이 선택을 바꿀 때마다 새 상태와 함께(만들 때는 부르지 않는다) — 허용된 곳에서 분석 코드를 켜고 끄는 자리 */
  onChange?: (state: ConsentState) => void
}

export type ConsentStore = {
  getState(): ConsentState
  /** 서버 렌더 · 하이드레이션 첫 그림용 — 늘 `unknown` */
  getServerState(): ConsentState
  subscribe(listener: () => void): () => void
  acceptAll(): void
  rejectAll(): void
  /** 범주별 선택 저장 — 모르는 id 는 버리고 필수 범주는 켠 채로 */
  save(choices: Record<string, boolean>): void
  /** 선택을 지우고 다시 묻는다(푸터의 「쿠키 설정」) */
  reset(): void
  /** 그 범주가 허용되었는가(필수 범주는 늘 true, 나머지는 선택을 마친 뒤에만) */
  has(category: string): boolean
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function createConsentStore({
  categories,
  required = ['necessary'],
  version,
  storageKey = 'consent',
  storage,
  now = () => new Date(),
  onChange,
}: ConsentStoreOptions): ConsentStore {
  if (categories.length === 0) throw new Error('consent: at least one category is needed')
  if (new Set(categories).size !== categories.length)
    throw new Error('consent: category ids must be unique')
  const mustBeOn = new Set(required.filter((id) => categories.includes(id)))
  const listeners = new Set<() => void>()
  const store = () => storage ?? browserStorage()

  const normalise = (choices: Record<string, boolean>) =>
    Object.fromEntries(categories.map((id) => [id, mustBeOn.has(id) || choices[id] === true]))
  const initial: ConsentState = { status: 'undecided', version, choices: normalise({}) }
  const unknown: ConsentState = { ...initial, status: 'unknown' }

  function read(): ConsentState {
    try {
      const raw = store()?.getItem(storageKey)
      if (!raw) return initial
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return initial
      const { version: saved, choices, decidedAt } = parsed as Record<string, unknown>
      if (saved !== version || typeof choices !== 'object' || choices === null) return initial
      return {
        status: 'decided',
        version,
        choices: normalise(choices as Record<string, boolean>),
        ...(typeof decidedAt === 'string' ? { decidedAt } : {}),
      }
    } catch {
      return initial
    }
  }

  let cache: ConsentState | undefined
  const getState = () => (cache ??= read())

  function commit(next: ConsentState) {
    cache = next
    try {
      if (next.status === 'decided')
        store()?.setItem(
          storageKey,
          JSON.stringify({ version, choices: next.choices, decidedAt: next.decidedAt }),
        )
      else store()?.removeItem(storageKey)
    } catch {
      // 저장이 막혀도(사생활 보호 모드) 이 페이지에서는 선택이 유지된다
    }
    for (const listener of listeners) listener()
    onChange?.(next)
  }
  const decide = (choices: Record<string, boolean>) =>
    commit({
      status: 'decided',
      version,
      choices: normalise(choices),
      decidedAt: now().toISOString(),
    })

  // 다른 탭에서 바꾼 선택을 따라간다
  let detach: (() => void) | undefined
  function subscribe(listener: () => void) {
    listeners.add(listener)
    if (!detach && typeof window !== 'undefined') {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== storageKey) return
        cache = read()
        for (const each of listeners) each()
      }
      window.addEventListener('storage', onStorage)
      detach = () => window.removeEventListener('storage', onStorage)
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        detach?.()
        detach = undefined
      }
    }
  }

  return {
    getState,
    getServerState: () => unknown,
    subscribe,
    acceptAll: () => decide(Object.fromEntries(categories.map((id) => [id, true]))),
    rejectAll: () => decide({}),
    save: (choices) => decide(choices),
    reset: () => commit(initial),
    has: (category) => {
      const state = getState()
      return (
        state.choices[category] === true && (state.status === 'decided' || mustBeOn.has(category))
      )
    },
  }
}
