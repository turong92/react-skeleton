import type { BookingApi } from './bookingApi'
import { bookingProblem, takenSeatIds, type BookingProblem } from './errors'
import type { SeatFeed } from './seatFeed'
import type { Hold } from './types'

export type HoldSnapshot = {
  /** 내 열린 보류(또는 방금 확정한 것). 없으면 null */
  hold: Hold | null
  /** 응답을 기다리는 자리 - 그 단추만 잠긴다 */
  pending: readonly string[]
  /** 결제 시작 · 나가기 · 확정 요청이 가는 중 */
  busy: boolean
  /** 결제를 시작해 자리를 바꿀 수 없다(더하기 · 빼기는 `HOLD_LOCKED`). 나가기만 된다 */
  locked: boolean
  /** 마지막 요청이 실패한 이유(화면이 한 줄로 알린다) - `dismissProblem` 으로 지운다 */
  problem: BookingProblem | null
  /** 실패한 요청의 오류(알 수 없는 오류의 참조 번호용) */
  error: unknown
}

export type HoldController = {
  getSnapshot(): HoldSnapshot
  subscribe(listener: () => void): () => void
  /** 화면을 열 때 - 내 열린 보류를 읽어 새로고침 뒤에도 이어 간다 */
  load(): Promise<void>
  /** 자리를 누른다 - 내 보류에 없으면 잡기, 있으면 놓기. 같은 자리 응답 전의 또 누름 · 결제 시작 뒤의 누름은 요청을 만들지 않는다 */
  pick(seatId: string): Promise<void>
  /** 결제 시작 - 금액을 박고 자리를 고정한다(멱등) */
  checkout(): Promise<Hold | null>
  /** 나가기 - 모두 놓기 */
  release(): Promise<void>
  /** 무료 확정 */
  confirm(): Promise<void>
  dismissProblem(): void
}

export type HoldControllerOptions = {
  poolId: string
  api: Pick<BookingApi, 'addSeats' | 'removeSeat' | 'myHolds' | 'checkout' | 'release' | 'confirm'>
  feed: Pick<SeatFeed, 'merge' | 'markTaken' | 'markOpen'>
  /** 대기실을 단 풀이다 - 입장권이 없으면 자리를 더하지 않는다 */
  requiresEntry: boolean
  /** 지금의 입장권(요청 때마다 읽는다) */
  getEntryToken?: () => string | null | undefined
}

/**
 * 내 보류 하나를 다룬다 - React 를 모른다. 요청은 한 줄로 이어서 보내(응답이 뒤바뀌어 보류가 옛 모습으로 덮이지 않게)
 * 같은 자리의 중복 누름은 버린다. 정확성은 서버가 정한다: 늦게 본 자리를 눌러 `409 SEAT_TAKEN` 이 오면 그 자리를 바로 선택 불가로 바꾼다.
 */
export function createHoldController({
  poolId,
  api,
  feed,
  requiresEntry,
  getEntryToken,
}: HoldControllerOptions): HoldController {
  const listeners = new Set<() => void>()
  let snapshot: HoldSnapshot = {
    hold: null,
    pending: [],
    busy: false,
    locked: false,
    problem: null,
    error: null,
  }
  let queue: Promise<unknown> = Promise.resolve()

  const set = (patch: Partial<HoldSnapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of [...listeners]) listener()
  }
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const next = queue.then(job, job)
    queue = next.catch(() => undefined)
    return next
  }
  const settle = (seatId: string) =>
    set({ pending: snapshot.pending.filter((id) => id !== seatId) })

  /** 실패를 알린다 - 보류가 사라진 갈래(시간 지남)는 보류도 비운다 */
  const fail = (error: unknown) => {
    const problem = bookingProblem(error)
    if (problem === 'seatTaken') feed.markTaken(takenSeatIds(error))
    set({
      problem,
      error,
      ...(problem === 'holdLocked' ? { locked: true } : {}),
      ...(problem === 'holdExpired' ? { hold: null, locked: false } : {}),
    })
  }

  const adopt = (hold: Hold) => {
    feed.merge(hold.seats)
    set({ hold })
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    load: async () => {
      try {
        const holds = await api.myHolds()
        const current = snapshot.hold
        const same = current && holds.find((h) => h.holdId === current.holdId)
        const open = holds.find((h) => h.poolId === poolId && h.status === 'HELD')
        const next = same ?? open
        if (next && (next.status === 'HELD' || next.status === 'CONFIRMED')) adopt(next)
        else if (current) set({ hold: null, locked: false })
      } catch (error) {
        fail(error)
      }
    },
    pick: async (seatId) => {
      const entryToken = getEntryToken?.() ?? null
      if (snapshot.locked || snapshot.busy || snapshot.pending.includes(seatId)) return
      const mine = snapshot.hold?.seats.some((seat) => seat.id === seatId) ?? false
      if (!mine && requiresEntry && !entryToken) return
      set({ pending: [...snapshot.pending, seatId], problem: null, error: null })
      await enqueue(async () => {
        try {
          if (mine) {
            adopt(await api.removeSeat(poolId, seatId))
            feed.markOpen(seatId)
          } else {
            adopt(await api.addSeats(poolId, [seatId], entryToken))
          }
        } catch (error) {
          fail(error)
        } finally {
          settle(seatId)
        }
      })
    },
    checkout: async () => {
      const hold = snapshot.hold
      if (!hold || snapshot.busy) return null
      set({ busy: true, problem: null, error: null })
      return enqueue(async () => {
        try {
          const started = await api.checkout(hold.holdId)
          adopt(started)
          set({ locked: true })
          return started
        } catch (error) {
          fail(error)
          return null
        } finally {
          set({ busy: false })
        }
      })
    },
    release: async () => {
      const hold = snapshot.hold
      if (!hold || snapshot.busy) return
      set({ busy: true, problem: null, error: null })
      await enqueue(async () => {
        try {
          const released = await api.release(hold.holdId)
          // 이미 결제가 끝난 보류(확정)면 자리를 놓은 게 아니다 - 확정된 모습을 보인다
          if (released.status === 'CONFIRMED') {
            adopt(released)
            set({ locked: true })
            return
          }
          for (const seat of hold.seats) feed.markOpen(seat.id)
          set({ hold: released.status === 'HELD' ? released : null, locked: false })
        } catch (error) {
          fail(error)
        } finally {
          set({ busy: false })
        }
      })
    },
    confirm: async () => {
      const hold = snapshot.hold
      if (!hold || snapshot.busy) return
      set({ busy: true, problem: null, error: null })
      await enqueue(async () => {
        try {
          adopt(await api.confirm(hold.holdId))
          set({ locked: true })
        } catch (error) {
          fail(error)
        } finally {
          set({ busy: false })
        }
      })
    },
    dismissProblem: () => set({ problem: null, error: null }),
  }
}
