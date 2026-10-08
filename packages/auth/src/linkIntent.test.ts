import { describe, expect, it } from 'vitest'
import { linkIntentOf, linkIntentState } from './linkIntent'
import { postSignInTarget } from './returnTo'

describe('link intent (router state only)', () => {
  it('carries the wanted provider and the settings section to go back to', () => {
    const state = linkIntentState('google', { pathname: '/account', hash: '#methods' })
    expect(linkIntentOf(state)).toEqual({ provider: 'google' })
    // 로그인 화면이 이미 아는 「가려던 곳」 관례(state.from)로 같은 구역에 돌아간다
    expect(postSignInTarget(state, '/')).toBe('/account#methods')
  })

  it('without a provider the state is only the way back', () => {
    const state = linkIntentState(undefined, { pathname: '/account', hash: '#methods' })
    expect(linkIntentOf(state)).toBeUndefined()
    expect(postSignInTarget(state, '/')).toBe('/account#methods')
  })

  it.each([
    [null],
    [undefined],
    [{}],
    [{ linkProvider: 3 }],
    [{ linkProvider: '' }],
    [{ linkProvider: '<script>' }],
    [{ linkProvider: 'a'.repeat(40) }],
    [{ linkProvider: 'https://evil.example' }],
  ])('ignores a state that is not a plain provider code: %j', (state) => {
    expect(linkIntentOf(state)).toBeUndefined()
  })

  it('a hostile way back falls to the default (open redirect stays closed)', () => {
    const state = linkIntentState('google', { pathname: '//evil.example', hash: '' })
    expect(postSignInTarget(state, '/')).toBe('/')
  })
})
