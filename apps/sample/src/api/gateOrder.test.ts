import { createLoginIdRequiredController } from '@skeleton/auth'
import { describe, expect, it } from 'vitest'
import { whenOuterGateSettled } from './gateOrder'

const settled = (promise: Promise<void>) => {
  let done = false
  void promise.then(() => (done = true))
  return () => done
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('whenOuterGateSettled - an inner gate asks only after the outer one answered and stepped aside', () => {
  it('waits until the outer gate has read the account (isReady)', async () => {
    const outer = createLoginIdRequiredController()
    const isDone = settled(whenOuterGateSettled(outer))
    await tick()
    expect(isDone()).toBe(false)
    outer.setReady(true)
    await tick()
    expect(isDone()).toBe(true)
  })

  it('keeps waiting while the outer gate is open, and goes on when it closes', async () => {
    const outer = createLoginIdRequiredController()
    outer.setReady(true)
    outer.require()
    const isDone = settled(whenOuterGateSettled(outer))
    await tick()
    expect(isDone()).toBe(false)
    outer.chosen()
    await tick()
    expect(isDone()).toBe(true)
  })

  it('is immediate when the outer gate is ready and idle', async () => {
    const outer = createLoginIdRequiredController()
    outer.setReady(true)
    const isDone = settled(whenOuterGateSettled(outer))
    await tick()
    expect(isDone()).toBe(true)
  })

  it('also goes on when the outer gate is left without choosing (decline)', async () => {
    const outer = createLoginIdRequiredController()
    outer.setReady(true)
    outer.require()
    const isDone = settled(whenOuterGateSettled(outer))
    outer.decline()
    await tick()
    expect(isDone()).toBe(true)
  })
})
