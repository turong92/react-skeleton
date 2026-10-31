import { describe, expect, it } from 'vitest'
import {
  disablePush,
  enablePush,
  isPushEnabled,
  syncPush,
  unregisterPush,
  type PushDeps,
} from './pushClient'
import { fakePushApi, fakePushEnv, KEY_A, KEY_B, memoryStorage } from './test/fakePush'

const INSTALLATION = 'inst_0123456789abcdef'

function setup(env = fakePushEnv(), accountId = 'acc_1') {
  const storage = memoryStorage({ 'skeleton.push.installation-id': INSTALLATION })
  const { api, log } = fakePushApi()
  const deps: PushDeps = { api, env, storage, accountId }
  return { deps, env, storage, api, log }
}

describe('enablePush (the click handler)', () => {
  it('asks for permission first, then subscribes with the server key and registers the device', async () => {
    const { deps, env, storage, log } = setup()
    expect(await enablePush(deps)).toBe('enabled')
    expect(env.state.log).toEqual(['requestPermission', 'subscribe'])
    expect(log).toEqual([`PUT ${INSTALLATION} https://push.example.com/send/abc`])
    expect(isPushEnabled(storage, 'acc_1')).toBe(true)
    // 다른 계정이 같은 브라우저에 로그인해도 켜져 있지 않다
    expect(isPushEnabled(storage, 'acc_2')).toBe(false)
  })

  it('a refused permission subscribes and registers nothing, and leaves no enabled mark', async () => {
    const { deps, env, storage, log } = setup(fakePushEnv({ answer: 'denied' }))
    expect(await enablePush(deps)).toBe('denied')
    expect(env.state.log).toEqual(['requestPermission'])
    expect(log).toEqual([])
    expect(isPushEnabled(storage, 'acc_1')).toBe(false)
  })
})

describe('syncPush (runs by itself after sign-in and when the window shows again)', () => {
  it('never asks for permission, whatever the state — only a click may', async () => {
    for (const permission of ['default', 'granted', 'denied'] as const) {
      for (const marked of [true, false]) {
        const { deps, env, storage } = setup(fakePushEnv({ permission }))
        if (marked) storage.setItem('skeleton.push.enabled.acc_1', '1')
        await syncPush(deps)
        expect(env.state.log, `${permission} marked=${marked}`).not.toContain('requestPermission')
      }
    }
  })

  it('without the enabled mark it does nothing at all (another person using this browser is not auto-enabled)', async () => {
    const { deps, env, log } = setup(fakePushEnv({ permission: 'granted' }))
    expect(await syncPush(deps)).toBe('off')
    expect(env.state.log).toEqual([])
    expect(log).toEqual([])
  })

  it('subscribes again when the server key changed, and re-registers', async () => {
    const { deps, env, storage, log } = setup(
      fakePushEnv({ permission: 'granted', subscribedWith: KEY_B }),
    )
    storage.setItem('skeleton.push.enabled.acc_1', '1')
    expect(await syncPush(deps)).toBe('synced')
    expect(env.state.log).toEqual(['unsubscribe', 'subscribe'])
    expect(log).toHaveLength(1)
  })

  it('keeps a subscription that already matches the key, and still registers (that refreshes last-seen)', async () => {
    const { deps, env, storage, log } = setup(
      fakePushEnv({ permission: 'granted', subscribedWith: KEY_A }),
    )
    storage.setItem('skeleton.push.enabled.acc_1', '1')
    expect(await syncPush(deps)).toBe('synced')
    expect(env.state.log).toEqual([])
    expect(log).toHaveLength(1)
  })

  it('no enabled mark for this account but a browser subscription exists (a previous account left it): drops it', async () => {
    const { deps, env, storage } = setup(
      fakePushEnv({ permission: 'granted', subscribedWith: KEY_A }),
    )
    expect(isPushEnabled(storage, 'acc_1')).toBe(false)
    expect(await syncPush(deps)).toBe('off')
    expect(env.state.log).toEqual(['unsubscribe'])
    expect(env.state.subscription).toBeNull()
  })

  it('permission turned to denied: removes the device on the server and clears the mark', async () => {
    const { deps, storage, log } = setup(fakePushEnv({ permission: 'denied' }))
    storage.setItem('skeleton.push.enabled.acc_1', '1')
    expect(await syncPush(deps)).toBe('revoked')
    expect(log).toEqual([`DELETE ${INSTALLATION}`])
    expect(isPushEnabled(storage, 'acc_1')).toBe(false)
  })
})

describe('disablePush / unregisterPush', () => {
  it('disable deletes the device, drops the browser subscription and clears the mark', async () => {
    const { deps, env, storage, log } = setup(
      fakePushEnv({ permission: 'granted', subscribedWith: KEY_A }),
    )
    storage.setItem('skeleton.push.enabled.acc_1', '1')
    await disablePush(deps)
    expect(log).toEqual([`DELETE ${INSTALLATION}`])
    expect(env.state.log).toEqual(['unsubscribe'])
    expect(isPushEnabled(storage, 'acc_1')).toBe(false)
  })

  it('sign-out order: the DELETE has finished when unregisterPush resolves, so the app can drop its token right after', async () => {
    const events: string[] = []
    const { api } = fakePushApi()
    const slow = {
      ...api,
      removeDevice: async (id: string) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        events.push(`deleted ${id}`)
      },
    }
    const storage = memoryStorage({ 'skeleton.push.installation-id': INSTALLATION })
    const env = fakePushEnv({ permission: 'granted', subscribedWith: KEY_A })
    await unregisterPush(slow, { storage, env })
    events.push('token cleared')
    expect(events).toEqual([`deleted ${INSTALLATION}`, 'token cleared'])
    // 서버 줄 뒤에 브라우저 구독도 거둔다
    expect(env.state.log).toEqual(['unsubscribe'])
  })

  it('a failing DELETE never blocks the sign-out', async () => {
    const { api } = fakePushApi()
    const failing = {
      ...api,
      removeDevice: async () => {
        throw new Error('offline')
      },
    }
    await expect(unregisterPush(failing, { storage: memoryStorage() })).resolves.toBeUndefined()
  })

  it('a failing DELETE still drops the browser subscription, so the next person on a shared browser gets nothing of this account', async () => {
    const { api } = fakePushApi()
    const failing = {
      ...api,
      removeDevice: async () => {
        throw new Error('offline')
      },
    }
    const env = fakePushEnv({ permission: 'granted', subscribedWith: KEY_A })
    await unregisterPush(failing, { storage: memoryStorage(), env })
    expect(env.state.subscription).toBeNull()
  })

  it('a failing unsubscribe never blocks the sign-out either', async () => {
    const { api } = fakePushApi()
    const env = {
      existingSubscription: async () => {
        throw new Error('no worker')
      },
    }
    await expect(unregisterPush(api, { storage: memoryStorage(), env })).resolves.toBeUndefined()
  })
})
