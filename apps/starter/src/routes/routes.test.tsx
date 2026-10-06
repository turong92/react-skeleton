import { RequireAuth } from '@skeleton/auth'
import { isValidElement } from 'react'
import { matchRoutes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function leaf(path: string) {
  const matches = matchRoutes(routes, path)
  return matches?.at(-1)?.route
}

describe('routes', () => {
  it('has a home page, the account lifecycle pages (login, sign-up, verify, reset, account) and a 404 catch-all', () => {
    expect(leaf('/')?.path).toBe('/')
    expect(leaf('/login')?.path).toBe('/login')
    expect(leaf('/sign-up')?.path).toBe('/sign-up')
    expect(leaf('/verify-email')?.path).toBe('/verify-email')
    expect(leaf('/reset-password')?.path).toBe('/reset-password')
    expect(leaf('/account')?.path).toBe('/account')
    expect(leaf('/definitely/not/here')?.path).toBe('*')
  })

  it('/account sits under the auth guard, / and /login do not', () => {
    const chain = (path: string) => matchRoutes(routes, path)!.map((m) => m.route)
    const guarded = (path: string) =>
      chain(path).some(
        (route) => isValidElement(route.element) && route.element.type === RequireAuth,
      )
    expect(guarded('/account')).toBe(true)
    expect(guarded('/')).toBe(false)
    expect(guarded('/login')).toBe(false)
    expect(guarded('/sign-up')).toBe(false)
    expect(guarded('/nope')).toBe(false)
  })
})
