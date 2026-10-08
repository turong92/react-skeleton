import { describe, expect, it } from 'vitest'
import { identifierProblem, magicLinkAddress, signInCredentials } from './signInIdentifier'
import { koAuthLabels } from './labels.ko'
import { mergeLabels } from './labels'

const labels = mergeLabels(koAuthLabels)

describe('signInCredentials — the one place that turns the sign-in input into a request body', () => {
  it('off: the input goes in `email` exactly as typed, whatever it looks like', () => {
    expect(signInCredentials('ann@example.com', 'pw', false)).toEqual({
      email: 'ann@example.com',
      password: 'pw',
    })
    expect(signInCredentials('sumin.kim', 'pw', false)).toEqual({
      email: 'sumin.kim',
      password: 'pw',
    })
  })

  it('on, with an @: it is an email (the 254-character field)', () => {
    expect(signInCredentials('sumin@example.com', 'pw', true)).toEqual({
      email: 'sumin@example.com',
      password: 'pw',
    })
  })

  it('on, without an @: it is a login id (the 64-character field), trimmed — dots and hyphens do not make it an email', () => {
    expect(signInCredentials('  sumin.kim ', 'pw', true)).toEqual({
      username: 'sumin.kim',
      password: 'pw',
    })
    expect(signInCredentials('sumin-kim', 'pw', true)).toEqual({
      username: 'sumin-kim',
      password: 'pw',
    })
  })

  it('on: the id keeps its capitals — the server normalizes', () => {
    expect(signInCredentials('Sumin.Kim', 'pw', true)).toEqual({
      username: 'Sumin.Kim',
      password: 'pw',
    })
  })
})

describe('identifierProblem', () => {
  it('off: only an empty input is a problem, and it says "email" (the screen as it was)', () => {
    expect(identifierProblem('', 'password', false, labels)).toBe(labels.problemEmailMissing)
    expect(identifierProblem(' ', 'magic', false, labels)).toBe(labels.problemEmailMissing)
    expect(identifierProblem('no-at-sign', 'password', false, labels)).toBeUndefined()
    expect(identifierProblem('no-at-sign', 'magic', false, labels)).toBeUndefined()
  })

  it('on, password: empty says "username or email"; a bare id is fine', () => {
    expect(identifierProblem('', 'password', true, labels)).toBe(labels.problemIdentifierMissing)
    expect(identifierProblem('sumin.kim', 'password', true, labels)).toBeUndefined()
  })

  it('on, magic link: a link goes to an address, so a value without @ asks for an email', () => {
    expect(identifierProblem('', 'magic', true, labels)).toBe(labels.problemEmailMissing)
    expect(identifierProblem('sumin.kim', 'magic', true, labels)).toBe(labels.problemEmailMissing)
    expect(identifierProblem('sumin@example.com', 'magic', true, labels)).toBeUndefined()
  })
})

describe('whitespace around an address (a text box no longer gets the trim the browser did for type="email")', () => {
  it('on: an email with spaces around it is sent trimmed (the backend validates the address as typed)', () => {
    expect(signInCredentials('sumin@example.com ', 'pw', true)).toEqual({
      email: 'sumin@example.com',
      password: 'pw',
    })
    expect(signInCredentials(' sumin@example.com', 'pw', true)).toEqual({
      email: 'sumin@example.com',
      password: 'pw',
    })
  })

  it('off: the body is exactly what it was - the input goes in `email` untouched', () => {
    expect(signInCredentials(' sumin@example.com ', 'pw', false)).toEqual({
      email: ' sumin@example.com ',
      password: 'pw',
    })
  })

  it('the magic link request gets the same trimmed address when the id is on, and the raw input when off', () => {
    expect(magicLinkAddress(' sumin@example.com ', true)).toBe('sumin@example.com')
    expect(magicLinkAddress(' sumin@example.com ', false)).toBe(' sumin@example.com ')
  })
})
