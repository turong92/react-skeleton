import type { ForbiddenContext } from '@skeleton/api-client'

/** 막(전면 화면) 컨트롤러가 가진 상태 — 이메일 막과 아이디 막이 같은 모양이다 */
export type GateState = { status: 'idle' } | { status: 'required' }

/** 이메일 · 아이디 막이 같이 쓰는 상태 기계의 내부 모양 — 각 컨트롤러가 자기 이름(`registered` · `chosen`)을 붙여 내보낸다 */
export type GateCore = {
  getState(): GateState
  subscribe(listener: () => void): () => void
  recover(context: ForbiddenContext): Promise<boolean>
  require(): void
  /** 끝났다(등록 · 정했다) — 화면을 닫고 붙잡은 호출을 true 로 푼다 */
  resolve(): void
  isReady(): boolean
  setReady(ready: boolean): void
  decline(): void
  setAccount(accountId: string | null): void
}

const IDLE: GateState = { status: 'idle' }
const REQUIRED: GateState = { status: 'required' }

/**
 * 「이 403 이 오면 화면을 열고 호출을 붙잡는다」의 상태 기계 — UI 가 없다. `matches` 가 이 막이 맡는 403 을 가린다.
 * 같은 때에 막힌 호출들은 하나의 화면을 공유하고, 끝나면 막혔던 호출을 **그대로 한 번 더** 보낸다(api-client 의 `recoverForbidden`).
 * 화면 · 붙잡은 호출은 한 계정의 것이다 — 계정이 바뀌면 접고, 로그아웃한 뒤에 늦게 온 403 은 화면을 다시 세우지 않는다.
 */
export function createGateCore(matches: (error: unknown) => boolean): GateCore {
  let state: GateState = IDLE
  let ready = false
  let account: string | null | undefined // undefined = 알린 적 없다
  const listeners = new Set<() => void>()
  let waiters: Array<(value: boolean) => void> = []

  const notify = () => {
    for (const listener of [...listeners]) listener()
  }
  const set = (next: GateState) => {
    if (next === state) return
    state = next
    notify()
  }
  const release = (value: boolean) => {
    const done = waiters
    waiters = []
    for (const resolve of done) resolve(value)
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    async recover({ error }) {
      if (!matches(error)) return false
      if (account === null) return false // 로그아웃한 뒤에 도착한 403 — 로그인 화면 위에 막을 세우지 않는다
      set(REQUIRED)
      return new Promise<boolean>((resolve) => waiters.push(resolve))
    },
    isReady: () => ready,
    setReady(next) {
      if (next === ready) return
      ready = next
      notify()
    },
    require: () => set(REQUIRED),
    resolve() {
      set(IDLE)
      release(true)
    },
    decline() {
      set(IDLE)
      release(false)
    },
    setAccount(next) {
      if (next === account) return
      const had = account !== undefined
      account = next
      // 이전 계정의 화면 · 붙잡은 호출은 새 계정의 것이 아니다(처음 알릴 때는 이미 열린 것이 있을 수 있어 그대로 둔다)
      if (had) {
        set(IDLE)
        release(false)
      }
    },
  }
}
