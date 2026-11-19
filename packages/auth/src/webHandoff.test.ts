import { describe, expect, it, vi } from 'vitest'
import { readHandoffCode } from './screens/handoffCode'
import {
  gateReducer,
  withoutHandoff,
  type GateEvent,
  type GatePhase,
} from './screens/webHandoffGateState'
import { createWebHandoffApi } from './webHandoffApi'

describe('readHandoffCode', () => {
  it('reads the code from the URL fragment only - a ?handoff= query is never trusted', () => {
    expect(readHandoffCode({ hash: '#handoff=abc' })).toBe('abc')
    expect(readHandoffCode({ hash: '#x=1&handoff=abc' })).toBe('abc')
    expect(readHandoffCode({ hash: '' })).toBeNull()
    expect(readHandoffCode({ hash: '#handoff=' })).toBeNull()
    expect(readHandoffCode({ hash: '#other=1' })).toBeNull()
  })
})

describe('withoutHandoff - the router location with the code taken out', () => {
  it('drops handoff from the fragment and from a stray query copy, keeps everything else, and is null when there is none', () => {
    expect(
      withoutHandoff({ pathname: '/pricing', search: '?plan=a', hash: '#handoff=abc&x=1' }),
    ).toEqual({ pathname: '/pricing', search: '?plan=a', hash: '#x=1' })
    expect(
      withoutHandoff({ pathname: '/pricing', search: '?handoff=zzz', hash: '#handoff=abc' }),
    ).toEqual({
      pathname: '/pricing',
      search: '',
      hash: '',
    })
    expect(withoutHandoff({ pathname: '/pricing', search: '?plan=a', hash: '#x=1' })).toBeNull()
  })
})

const read = (over: Partial<Extract<GateEvent, { type: 'read' }>> = {}): GateEvent => ({
  type: 'read',
  code: 'c1',
  signedIn: false,
  path: '/pricing',
  ...over,
})
const pending: GatePhase = { kind: 'pending' }

describe('gateReducer - when the gate lets go of the screen', () => {
  it('opens at once without a code, and swaps the account only after asking when already signed in', () => {
    expect(gateReducer(pending, read({ code: null }))).toEqual({ kind: 'open' })
    expect(gateReducer(pending, read())).toEqual({ kind: 'redeem', code: 'c1', anchor: '/pricing' })
    // 이미 로그인한 브라우저: 묻기 전에는 코드를 바꾸지 않는다(login CSRF)
    const asked = gateReducer(pending, read({ signedIn: true }))
    expect(asked).toEqual({ kind: 'confirm', code: 'c1', anchor: '/pricing' })
    expect(gateReducer(asked, { type: 'confirmed' })).toEqual({
      kind: 'redeem',
      code: 'c1',
      anchor: '/pricing',
    })
    expect(gateReducer(asked, { type: 'cancelled' })).toEqual({ kind: 'open' })
  })

  it('reads only once - a later read (the address changed) never restarts it', () => {
    const open = gateReducer(pending, read({ code: null }))
    expect(gateReducer(open, read())).toBe(open)
  })

  it('opens after the code was exchanged, and when the screen is left by a link or a two-factor redirect', () => {
    const redeeming = gateReducer(pending, read())
    expect(gateReducer(redeeming, { type: 'signedIn' })).toEqual({ kind: 'open' })
    // 쓸 수 없는 링크 화면의 「로그인」 링크 · 2단계로 보내기 = 경로가 바뀐다
    expect(gateReducer(redeeming, { type: 'moved', path: '/login' })).toEqual({ kind: 'open' })
    expect(gateReducer(redeeming, { type: 'moved', path: '/pricing' })).toBe(redeeming)
    const asked = gateReducer(pending, read({ signedIn: true }))
    expect(gateReducer(asked, { type: 'moved', path: '/login' })).toEqual({ kind: 'open' })
  })

  it('does nothing to an unread gate', () => {
    expect(gateReducer(pending, { type: 'moved', path: '/x' })).toBe(pending)
    expect(gateReducer(pending, { type: 'cancelled' })).toBe(pending)
  })
})

describe('createWebHandoffApi', () => {
  it('posts the code to the public redeem route, without credentials, with the device name when given', async () => {
    const value = vi.fn(async () => ({ accessToken: 'a' }))
    const api = createWebHandoffApi({ value } as never)
    await api.redeem('abc', { deviceName: 'Pixel' })
    expect(value).toHaveBeenCalledWith('/auth/web-handoff/redeem', {
      method: 'POST',
      json: { code: 'abc' },
      skipAuth: true,
      headers: { 'X-Device-Name': 'Pixel' },
    })
    await api.redeem('abc')
    expect(value).toHaveBeenLastCalledWith('/auth/web-handoff/redeem', {
      method: 'POST',
      json: { code: 'abc' },
      skipAuth: true,
    })
  })
})
