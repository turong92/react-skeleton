import { describe, expect, it } from 'vitest'
import { createAuthorMemory, type StorageLike } from './authorMemory'

function memoryStorage(): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  }
}

const throwing: StorageLike = {
  length: 1,
  key: () => {
    throw new Error('blocked')
  },
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('quota')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('createAuthorMemory — which profile this device wrote with last, per board', () => {
  it('remembers one profile id per board code', () => {
    const memory = createAuthorMemory(memoryStorage(), 'acc_1')
    memory.set('free', 'prf_a')
    memory.set('news', 'prf_b')
    expect(memory.get('free')).toBe('prf_a')
    expect(memory.get('news')).toBe('prf_b')
    expect(memory.get('other')).toBeUndefined()
  })

  it('keeps accounts apart: the account id is inside the storage key only, the value is the profile id and nothing else', () => {
    const storage = memoryStorage()
    createAuthorMemory(storage, 'acc_1').set('free', 'prf_a')
    expect(createAuthorMemory(storage, 'acc_2').get('free')).toBeUndefined()
    expect(Object.values(storage.dump())).toEqual(['prf_a'])
    expect(Object.keys(storage.dump()).join('')).toContain('acc_1')
  })

  it('a board code with the key separator in it cannot collide with another account', () => {
    const storage = memoryStorage()
    createAuthorMemory(storage, 'acc_1').set('x:acc_2:y', 'prf_a')
    expect(createAuthorMemory(storage, 'acc_2').get('y')).toBeUndefined()
  })

  it('set with undefined clears that board', () => {
    const memory = createAuthorMemory(memoryStorage(), 'acc_1')
    memory.set('free', 'prf_a')
    memory.set('free', undefined)
    expect(memory.get('free')).toBeUndefined()
  })

  it('forget() wipes everything this module wrote — every board, every account — and nothing else', () => {
    const storage = memoryStorage()
    storage.setItem('theme', 'dark')
    createAuthorMemory(storage, 'acc_1').set('free', 'prf_a')
    createAuthorMemory(storage, 'acc_2').set('news', 'prf_b')
    createAuthorMemory(storage, 'acc_1').forget()
    expect(storage.dump()).toEqual({ theme: 'dark' })
  })

  it('swallows every storage exception (private mode, blocked site data, full quota)', () => {
    const memory = createAuthorMemory(throwing, 'acc_1')
    expect(() => memory.set('free', 'prf_a')).not.toThrow()
    expect(memory.get('free')).toBeUndefined()
    expect(() => memory.forget()).not.toThrow()
  })

  it('without a storage (server render, blocked) it remembers nothing and does not throw', () => {
    const memory = createAuthorMemory(undefined, 'acc_1')
    memory.set('free', 'prf_a')
    expect(memory.get('free')).toBeUndefined()
    expect(() => memory.forget()).not.toThrow()
  })
})
