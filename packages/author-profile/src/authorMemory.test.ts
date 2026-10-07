import { describe, expect, it } from 'vitest'
import { createAuthorMemory, forgetAuthorMemory, type StorageLike } from './authorMemory'

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
    expect(Object.values(storage.dump())).toEqual(['prf_a'])
    expect(Object.keys(storage.dump()).join('')).toContain('acc_1')
    // 다른 계정이 이 기기를 쓰기 시작하면 앞 계정의 것은 보이지도 남지도 않는다
    expect(createAuthorMemory(storage, 'acc_2').get('free')).toBeUndefined()
    expect(storage.length).toBe(0)
  })

  it('the key separator inside an account id or a board code cannot make two different (account, board) pairs share a key', () => {
    const keyFor = (account: string, board: string) => {
      const storage = memoryStorage()
      createAuthorMemory(storage, account).set(board, 'prf_x')
      return Object.keys(storage.dump())
    }
    // ('a', 'b:c') 와 ('a:b', 'c') 는 구분자를 붙여 쓰면 같은 글자열이 된다
    const one = keyFor('a', 'b:c')
    const two = keyFor('a:b', 'c')
    expect(one).toHaveLength(1)
    expect(two).toHaveLength(1)
    expect(one[0]).not.toBe(two[0])
    // 같은 계정이 두 게시판을 쓸 때도 다른 키
    const storage = memoryStorage()
    const memory = createAuthorMemory(storage, 'a')
    memory.set('b:c', 'prf_1')
    memory.set('b', 'prf_2')
    expect(Object.keys(storage.dump())).toHaveLength(2)
    expect(memory.get('b:c')).toBe('prf_1')
    expect(memory.get('b')).toBe('prf_2')
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

  it('forgetAuthorMemory(storage) wipes the same keys without knowing an account id (the logout / account-change hook has none left to give)', () => {
    const storage = memoryStorage()
    storage.setItem('theme', 'dark')
    createAuthorMemory(storage, 'acc_1').set('free', 'prf_a')
    createAuthorMemory(storage, 'acc_2').set('news', 'prf_b')
    forgetAuthorMemory(storage)
    expect(storage.dump()).toEqual({ theme: 'dark' })
    expect(() => forgetAuthorMemory(undefined)).not.toThrow()
    expect(() => forgetAuthorMemory(throwing)).not.toThrow()
  })

  it("creating a memory for an account removes the other accounts' entries of this module (the device keeps only the current account's), and nothing else", () => {
    const storage = memoryStorage()
    storage.setItem('theme', 'dark')
    createAuthorMemory(storage, 'acc_old').set('free', 'prf_old')
    createAuthorMemory(storage, 'acc_old').set('news', 'prf_old2')
    const mine = createAuthorMemory(storage, 'acc_me')
    mine.set('free', 'prf_a')
    expect(Object.keys(storage.dump()).some((key) => key.includes('acc_old'))).toBe(false)
    expect(mine.get('free')).toBe('prf_a')
    // 다시 만들어도(렌더 · 탭) 현재 계정의 것은 남는다
    expect(createAuthorMemory(storage, 'acc_me').get('free')).toBe('prf_a')
    expect(storage.getItem('theme')).toBe('dark')
  })

  it('matches the account part exactly: acc_10 is not "acc_1 plus a bit" — creating for acc_1 clears acc_10\'s entry', () => {
    const storage = memoryStorage()
    createAuthorMemory(storage, 'acc_10').set('free', 'prf_a')
    const one = createAuthorMemory(storage, 'acc_1')
    expect(Object.keys(storage.dump())).toEqual([])
    one.set('free', 'prf_b')
    expect(createAuthorMemory(storage, 'acc_1').get('free')).toBe('prf_b')
  })
})
