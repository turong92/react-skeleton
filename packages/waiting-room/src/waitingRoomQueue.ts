import { ApiRequestError } from '@skeleton/api-client'
import type { WaitingRoomApi } from './waitingRoomApi'
import type { WaitingRoomStatus } from './types'

export type WaitingRoomStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** `started` 는 줄 서기를 시작했는가, `status` 는 서버가 마지막으로 말한 것(첫 답 전에는 null), `error` 는 마지막 확인이 실패했을 때만 */
export type WaitingRoomSnapshot = {
  started: boolean
  status: WaitingRoomStatus | null
  error: unknown
}

/** `enter()` 가 입장권을 못 얻고 끝났다 - 줄이 닫혔다(`closed`) · 입장 시간이 끝났다(`expired`) · 화면이 떠났다(`stopped`) */
export class WaitingRoomEntryError extends Error {
  readonly reason: 'closed' | 'expired' | 'stopped'
  constructor(reason: 'closed' | 'expired' | 'stopped') {
    super(reason)
    this.name = 'WaitingRoomEntryError'
    this.reason = reason
  }
}

export type WaitingRoomQueueOptions = {
  api: WaitingRoomApi
  roomId: string
  /** 순번표를 두는 곳(기본 `sessionStorage`, 못 쓰면 메모리에만) */
  storage?: WaitingRoomStorage
}

export type WaitingRoomQueue = {
  getSnapshot(): WaitingRoomSnapshot
  subscribe(listener: () => void): () => void
  /** 줄 서기 시작 - 이미 시작했으면 아무것도 안 한다 */
  start(): void
  /** 묻기를 멈춘다(순번표는 저장소에 남는다) */
  stop(): void
  /** 입장 시간이 끝난 뒤 다시 줄 서기(저장한 순번표를 버리고 새로 받는다) */
  rejoin(): void
  /** 줄을 서고 입장권을 기다렸다 돌려준다 */
  entry(): Promise<string>
}

/** 확인에 실패했을 때 다시 묻기까지(ms) */
const RETRY_MS = 10_000
/** 서버 값이 이상해도(0 · NaN) 서버를 몰아치지 않게 하는 아래 한계(초) */
const MIN_POLL_SECONDS = 1
/** 서버가 이 순번표를 받아들이지 않는다(위조 · 다른 계정 · 없는 방) - 버리고 새로 받는다 */
const REFUSED = [400, 403, 404, 410]

const INITIAL: WaitingRoomSnapshot = { started: false, status: null, error: null }

function browserStorage(): WaitingRoomStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  } catch {
    return undefined
  }
}

/**
 * 한 방의 줄 서기 - React 를 모른다. 순번표를 받거나 저장소에서 꺼내고, 서버가 정한 초(`pollAfterSeconds`)마다 상태를 묻는다.
 * 입장권(`entryToken`)은 메모리에만 있다. 닫힘 · 입장 시간 끝에서는 더 묻지 않는다.
 */
export function createWaitingRoomQueue({
  api,
  roomId,
  storage,
}: WaitingRoomQueueOptions): WaitingRoomQueue {
  const key = `waiting-room:${roomId}`
  let snapshot = INITIAL
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const waiters = new Set<{ resolve: (token: string) => void; reject: (error: Error) => void }>()

  const store = () => storage ?? browserStorage()
  const read = () => {
    try {
      return store()?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  const write = (token: string | null) => {
    try {
      if (token === null) store()?.removeItem(key)
      else store()?.setItem(key, token)
    } catch {
      // 저장소를 못 쓰면 새로고침 뒤에 다시 받을 뿐이다(같은 순번표)
    }
  }

  const settleWaiters = () => {
    const status = snapshot.status
    if (!status) return
    for (const waiter of [...waiters]) {
      if (status.state === 'ADMITTED' && status.entryToken) waiter.resolve(status.entryToken)
      else if (status.state === 'CLOSED') waiter.reject(new WaitingRoomEntryError('closed'))
      else if (status.state === 'EXPIRED') waiter.reject(new WaitingRoomEntryError('expired'))
      else continue
      waiters.delete(waiter)
    }
  }

  const set = (next: WaitingRoomSnapshot) => {
    snapshot = next
    for (const listener of [...listeners]) listener()
    settleWaiters()
  }

  const later = (run: () => void, ms: number) => {
    timer = setTimeout(run, ms)
  }

  async function step(run: number, ticket: string | null, retaken: boolean): Promise<void> {
    try {
      if (ticket === null) {
        ticket = (await api.takeTicket(roomId)).ticketToken
        if (run !== generation) return
        write(ticket)
      }
      const status = await api.status(roomId, ticket)
      if (run !== generation) return
      set({ started: true, status, error: null })
      if (status.state === 'CLOSED' || status.state === 'EXPIRED') return
      const seconds = Math.max(MIN_POLL_SECONDS, status.pollAfterSeconds || 0)
      const known = ticket
      later(() => void step(run, known, false), seconds * 1000)
    } catch (error) {
      if (run !== generation) return
      if (
        ticket !== null &&
        !retaken &&
        error instanceof ApiRequestError &&
        REFUSED.includes(error.apiError.status)
      ) {
        write(null)
        return step(run, null, true)
      }
      set({ ...snapshot, error })
      const known = ticket
      later(() => void step(run, known, false), RETRY_MS)
    }
  }

  const stop = () => {
    generation++
    clearTimeout(timer)
    if (snapshot.started) snapshot = { ...snapshot, started: false }
    for (const waiter of [...waiters]) waiter.reject(new WaitingRoomEntryError('stopped'))
    waiters.clear()
  }

  const start = () => {
    if (snapshot.started) return
    snapshot = { ...snapshot, started: true }
    for (const listener of [...listeners]) listener()
    void step(++generation, read(), false)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start,
    stop,
    rejoin: () => {
      stop()
      write(null)
      snapshot = INITIAL
      start()
    },
    entry: () => {
      const state = snapshot.status?.state
      if (state === 'EXPIRED') {
        stop()
        write(null)
        snapshot = INITIAL
      }
      if (state === 'CLOSED') return Promise.reject(new WaitingRoomEntryError('closed'))
      return new Promise<string>((resolve, reject) => {
        waiters.add({ resolve, reject })
        start()
        settleWaiters()
      })
    },
  }
}
