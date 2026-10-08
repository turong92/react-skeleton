import { describe, expect, it } from 'vitest'
import type { AccountApi } from '../account/accountApi'
import type { AuthMethodsWire } from '../types'
import { resolveDiscoveredFlows } from './discovery'

const info: AuthMethodsWire = {
  methods: ['password'],
  signUp: { password: true, emailVerification: true, social: true },
  social: [{ provider: 'google', clientId: 'c', redirectUri: 'https://app.test/auth/callback' }],
  captchaRequired: false,
  refreshDelivery: 'body',
}
const social = { session: { socialLogin: async () => ({}) as never } }
const accountApi = {} as AccountApi
const paths = { socialCallback: '/auth/callback', socialLinkCallback: '/account/link-callback' }
const input = () => ({
  info,
  social,
  accountApi,
  paths,
  // 렌더마다 새 객체로 들어온다 — 내용이 같으면 같은 재료다
  statePrefixes: { social: 'a.social.', socialLink: 'a.link.' },
  origin: 'https://app.test',
})

describe('resolveDiscoveredFlows — one flow per routes instance while its ingredients are the same', () => {
  it('asked again with the same ingredients (a remounted page, a fresh prefixes object) it returns the same flows', () => {
    const notes = { warned: false }
    const first = resolveDiscoveredFlows(notes, input())
    const again = resolveDiscoveredFlows(notes, input())
    expect(first.socialFlow).toBeDefined()
    expect(again.socialFlow).toBe(first.socialFlow)
    expect(again.socialLinkFlow).toBe(first.socialLinkFlow)
  })

  it('another routes instance (another notes) has its own flows — nothing is shared module-wide', () => {
    const a = resolveDiscoveredFlows({ warned: false }, input())
    const b = resolveDiscoveredFlows({ warned: false }, input())
    expect(b.socialFlow).not.toBe(a.socialFlow)
  })

  it('a different answer from the backend, or other prefixes, builds new flows', () => {
    const notes = { warned: false }
    const first = resolveDiscoveredFlows(notes, input())
    const other = { ...info }
    const changed = resolveDiscoveredFlows(notes, { ...input(), info: other })
    expect(changed.socialFlow).not.toBe(first.socialFlow)
    const prefixed = resolveDiscoveredFlows(notes, {
      ...input(),
      info: other,
      statePrefixes: { social: 'b.social.', socialLink: 'b.link.' },
    })
    expect(prefixed.socialFlow).not.toBe(changed.socialFlow)
  })

  it('no social config or no usable provider → no flows', () => {
    const none = resolveDiscoveredFlows({ warned: false }, { ...input(), social: undefined })
    expect(none.socialFlow).toBeUndefined()
    expect(none.socialLinkFlow).toBeUndefined()
  })
})
