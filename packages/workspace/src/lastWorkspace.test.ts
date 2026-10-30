import { describe, expect, it } from 'vitest'
import { createLastWorkspaceMemory, forgetLastWorkspace, pickLandingSlug } from './lastWorkspace'
import { memoryStorage } from './test/memoryStorage'

describe('createLastWorkspaceMemory (the team to open first — never read for a /w/<slug> address)', () => {
  it('remembers per account and forgets one account without touching another', () => {
    const storage = memoryStorage()
    const ann = createLastWorkspaceMemory(storage, 'acc_ann')
    const bea = createLastWorkspaceMemory(storage, 'acc_bea')
    ann.write('acme')
    expect(ann.read()).toBe('acme')
    expect(bea.read()).toBeUndefined()
    ann.clear()
    expect(ann.read()).toBeUndefined()
  })
  it('forgetLastWorkspace clears every account on this device (log out) and leaves other keys alone', () => {
    const storage = memoryStorage({ other: 'x' })
    createLastWorkspaceMemory(storage, 'acc_ann').write('acme')
    createLastWorkspaceMemory(storage, 'acc_bea').write('globex')
    forgetLastWorkspace(storage)
    expect(createLastWorkspaceMemory(storage, 'acc_ann').read()).toBeUndefined()
    expect(createLastWorkspaceMemory(storage, 'acc_bea').read()).toBeUndefined()
    expect(storage.getItem('other')).toBe('x')
  })
  it('works without a storage and swallows storage errors (memory is a convenience)', () => {
    const none = createLastWorkspaceMemory(undefined, 'acc_ann')
    none.write('acme')
    expect(none.read()).toBeUndefined()
    const broken = memoryStorage()
    broken.getItem = () => {
      throw new Error('blocked')
    }
    broken.setItem = () => {
      throw new Error('blocked')
    }
    const memory = createLastWorkspaceMemory(broken, 'acc_ann')
    expect(() => memory.write('acme')).not.toThrow()
    expect(memory.read()).toBeUndefined()
  })
})

describe('pickLandingSlug', () => {
  const list = [
    { id: 'ws_1', name: 'Acme', slug: 'acme', role: 'OWNER' as const },
    { id: 'ws_2', name: 'Globex', slug: 'globex', role: 'MEMBER' as const },
  ]
  it('prefers the remembered team while the account is still in it', () => {
    expect(pickLandingSlug(list, 'globex')).toBe('globex')
  })
  it('falls back to the first team when the remembered one is gone (left, removed, closed)', () => {
    expect(pickLandingSlug(list, 'initech')).toBe('acme')
    expect(pickLandingSlug(list, undefined)).toBe('acme')
  })
  it('is undefined with no team at all (the screen offers to create one)', () => {
    expect(pickLandingSlug([], 'acme')).toBeUndefined()
  })
})
