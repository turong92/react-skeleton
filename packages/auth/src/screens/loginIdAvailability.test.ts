import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoginIdAvailability } from '../account/types'
import {
  LOGIN_ID_CHECK_DELAY_MS,
  createLoginIdChecker,
  loginIdCheckState,
} from './loginIdAvailability'

/* 설계 §13.1 「아이디 칸과 실시간 확인」 — 디바운스 0.4초 · 늦은 답 버리기 · 같은 값 다시 안 묻기 · 다섯 상태 */
const rules = { minLength: 4, maxLength: 20 }

function deferred() {
  let resolve!: (value: LoginIdAvailability) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<LoginIdAvailability>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const ok = (normalized: string): LoginIdAvailability => ({ normalized, available: true })
const taken = (normalized: string): LoginIdAvailability => ({
  normalized,
  available: false,
  reason: 'TAKEN',
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createLoginIdChecker', () => {
  it('waits 0.4 seconds after the last input before it asks, and asks once', async () => {
    const check = vi.fn(async (id: string) => ok(id))
    const checker = createLoginIdChecker({ check })
    checker.request('sumin')
    await vi.advanceTimersByTimeAsync(LOGIN_ID_CHECK_DELAY_MS - 1)
    expect(check).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(check).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledWith('sumin')
    expect(checker.getAnswers()).toEqual({ sumin: 'available' })
    expect(LOGIN_ID_CHECK_DELAY_MS).toBe(400)
  })

  it('typing again restarts the wait — only the last value is asked', async () => {
    const check = vi.fn(async (id: string) => ok(id))
    const checker = createLoginIdChecker({ check })
    checker.request('sumi')
    await vi.advanceTimersByTimeAsync(300)
    checker.request('sumin')
    await vi.advanceTimersByTimeAsync(300)
    expect(check).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(check.mock.calls).toEqual([['sumin']])
  })

  it('throws away an answer that arrives after the value changed (the last input wins)', async () => {
    const first = deferred()
    const second = deferred()
    const check = vi.fn((id: string) => (id === 'sumin' ? first.promise : second.promise))
    const checker = createLoginIdChecker({ check })
    checker.request('sumin')
    await vi.advanceTimersByTimeAsync(400)
    checker.request('sumin2')
    first.resolve(taken('sumin')) // 늦게 온 답
    await vi.advanceTimersByTimeAsync(0)
    expect(checker.getAnswers()).toEqual({})
    await vi.advanceTimersByTimeAsync(400)
    second.resolve(ok('sumin2'))
    await vi.advanceTimersByTimeAsync(0)
    expect(checker.getAnswers()).toEqual({ sumin2: 'available' })
  })

  it('does not ask the same value twice (available and taken are remembered)', async () => {
    const check = vi.fn(async (id: string) => (id === 'sumin' ? ok(id) : taken(id)))
    const checker = createLoginIdChecker({ check })
    checker.request('sumin')
    await vi.advanceTimersByTimeAsync(400)
    checker.request('admin')
    await vi.advanceTimersByTimeAsync(400)
    expect(checker.getAnswers()).toEqual({ sumin: 'available', admin: 'taken' })
    checker.request('sumin')
    checker.request('admin')
    await vi.advanceTimersByTimeAsync(1000)
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('a failed check (429 · network) reads as unknown, and asking that value again retries', async () => {
    const check = vi
      .fn<(id: string) => Promise<LoginIdAvailability>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(ok('sumin'))
    const checker = createLoginIdChecker({ check })
    checker.request('sumin')
    await vi.advanceTimersByTimeAsync(400)
    expect(checker.getAnswers()).toEqual({ sumin: 'unknown' })
    checker.request('sumin2')
    checker.request('sumin') // 같은 값으로 돌아와도 「모름」은 다시 묻는다
    await vi.advanceTimersByTimeAsync(400)
    expect(check).toHaveBeenCalledTimes(2)
    expect(checker.getAnswers()).toEqual({ sumin: 'available' })
  })

  it('markTaken writes what the SERVER said at submit time (409) over an earlier "available", and never asks again', async () => {
    const check = vi.fn(async (id: string) => ok(id))
    const checker = createLoginIdChecker({ check })
    checker.request('race.winner')
    await vi.advanceTimersByTimeAsync(400)
    expect(checker.getAnswers()).toEqual({ 'race.winner': 'available' })
    const listener = vi.fn()
    checker.subscribe(listener)
    checker.markTaken('race.winner')
    expect(checker.getAnswers()).toEqual({ 'race.winner': 'taken' })
    expect(listener).toHaveBeenCalledTimes(1)
    checker.request('race.winner') // 같은 값으로 돌아와도 다시 묻지 않는다
    await vi.advanceTimersByTimeAsync(1000)
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('cancel() stops a pending wait and drops an answer on its way', async () => {
    const pending = deferred()
    const check = vi.fn((id: string) =>
      id === 'sumin' ? pending.promise : Promise.resolve(ok(id)),
    )
    const checker = createLoginIdChecker({ check })
    checker.request('waiting')
    checker.cancel()
    await vi.advanceTimersByTimeAsync(1000)
    expect(check).not.toHaveBeenCalled()
    checker.request('sumin')
    await vi.advanceTimersByTimeAsync(400)
    checker.cancel()
    pending.resolve(ok('sumin'))
    await vi.advanceTimersByTimeAsync(0)
    expect(checker.getAnswers()).toEqual({})
  })

  it('asks through the newest check function (the api the screen holds now)', async () => {
    const old = vi.fn(async (id: string) => ok(id))
    const fresh = vi.fn(async (id: string) => taken(id))
    const checker = createLoginIdChecker({ check: old })
    checker.replaceCheck(fresh)
    checker.request('sumin')
    await vi.advanceTimersByTimeAsync(400)
    expect(old).not.toHaveBeenCalled()
    expect(checker.getAnswers()).toEqual({ sumin: 'taken' })
  })

  it('tells subscribers when the answers change, with a new object each time', async () => {
    const checker = createLoginIdChecker({ check: async (id) => ok(id) })
    const listener = vi.fn()
    const unsubscribe = checker.subscribe(listener)
    const before = checker.getAnswers()
    checker.request('sumin')
    await vi.advanceTimersByTimeAsync(400)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(checker.getAnswers()).not.toBe(before)
    unsubscribe()
    checker.request('sumin2')
    await vi.advanceTimersByTimeAsync(400)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('loginIdCheckState — the five states', () => {
  const state = (
    value: string,
    answers: Record<string, 'available' | 'taken' | 'unknown'> = {},
    touched = false,
  ) => loginIdCheckState({ value, rules, answers, touched })

  it('format wrong: invalid with the kind of problem — blocks submit, but is only shown after the field was left', () => {
    const empty = state('')
    expect(empty).toMatchObject({ status: 'invalid', problem: 'missing', canSubmit: false })
    expect(empty.showError).toBe(false)
    expect(state('', {}, true).showError).toBe(true)
    expect(state('ab', {}, true)).toMatchObject({
      status: 'invalid',
      problem: 'size',
      showError: true,
    })
    expect(state('su@min', {}, true).problem).toBe('chars')
  })

  it('a well-formed value that has no answer yet is "checking" — and may be submitted', () => {
    expect(state('Sumin.Kim')).toMatchObject({
      status: 'checking',
      normalized: 'sumin.kim',
      canSubmit: true,
      showError: false,
    })
  })

  it('available: submit allowed; says "saved as" only when capitals or blanks were normalised away', () => {
    expect(state('sumin.kim', { 'sumin.kim': 'available' })).toMatchObject({
      status: 'available',
      canSubmit: true,
      savedAsNormalized: false,
    })
    expect(state('Sumin.Kim', { 'sumin.kim': 'available' }).savedAsNormalized).toBe(true)
    expect(state(' sumin.kim ', { 'sumin.kim': 'available' }).savedAsNormalized).toBe(false)
  })

  it('taken: blocks submit and the error shows at once (no need to leave the field)', () => {
    expect(state('admin', { admin: 'taken' })).toMatchObject({
      status: 'taken',
      canSubmit: false,
      showError: true,
    })
  })

  it('could not check: submit allowed — the server decides', () => {
    expect(state('sumin', { sumin: 'unknown' })).toMatchObject({
      status: 'unknown',
      canSubmit: true,
      showError: false,
    })
  })

  it('an answer for another value never leaks onto this one', () => {
    expect(state('sumin2', { sumin: 'taken' }).status).toBe('checking')
  })

  it('a value that fails the format is invalid even if the answers know it', () => {
    expect(state('ab', { ab: 'available' }).status).toBe('invalid')
  })
})
