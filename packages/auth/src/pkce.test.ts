import { describe, expect, it } from 'vitest'
import {
  codeChallengeS256,
  createCodeVerifier,
  createNonce,
  createState,
  hasWebCrypto,
  PkceUnavailableError,
} from './pkce'

describe('PKCE S256 (RFC 7636)', () => {
  it('derives the RFC 7636 appendix B challenge from the appendix B verifier', async () => {
    expect(await codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('makes a verifier of 43 characters from the unreserved alphabet, different every time', () => {
    const a = createCodeVerifier()
    const b = createCodeVerifier()
    expect(a).toMatch(/^[A-Za-z0-9\-._~]{43}$/)
    expect(a).not.toBe(b)
  })

  it('makes a nonce of printable ASCII without spaces (8-256) and a state of at least 16 bytes', () => {
    const nonce = createNonce()
    expect(nonce).toMatch(/^[\x21-\x7e]{8,256}$/)
    expect(createState().length).toBeGreaterThanOrEqual(22) // 16 bytes in base64url
    expect(createNonce()).not.toBe(nonce)
  })

  it('refuses to invent a verifier without WebCrypto instead of falling back to Math.random', async () => {
    expect(hasWebCrypto()).toBe(true)
    const crypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      expect(hasWebCrypto()).toBe(false)
      expect(() => createCodeVerifier()).toThrow(PkceUnavailableError)
      await expect(codeChallengeS256('x'.repeat(43))).rejects.toBeInstanceOf(PkceUnavailableError)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true })
    }
  })
})
