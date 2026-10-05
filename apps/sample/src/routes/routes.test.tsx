import { RequireAuth } from '@skeleton/auth'
import { isValidElement } from 'react'
import { matchRoutes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function leaf(path: string) {
  return matchRoutes(routes, path)?.at(-1)?.route
}
const chain = (path: string) => matchRoutes(routes, path)!.map((m) => m.route)
const guarded = (path: string) =>
  chain(path).some((route) => isValidElement(route.element) && route.element.type === RequireAuth)

describe('routes', () => {
  it('has every screen of the journey: dashboard, list, create, detail, edit, settings, login, 404', () => {
    expect(leaf('/')?.path).toBe('/')
    expect(leaf('/notes')?.path).toBe('/notes')
    expect(leaf('/notes/new')?.path).toBe('/notes/new')
    expect(leaf('/notes/abc')?.path).toBe('/notes/:id')
    expect(leaf('/notes/abc/edit')?.path).toBe('/notes/:id/edit')
    expect(leaf('/settings')?.path).toBe('/settings')
    expect(leaf('/login')?.path).toBe('/login')
    expect(leaf('/nope/nope')?.path).toBe('*')
  })

  it('everything except login and the 404 sits under the auth guard', () => {
    for (const path of ['/', '/notes', '/notes/new', '/notes/abc', '/notes/abc/edit', '/settings'])
      expect(guarded(path), path).toBe(true)
    for (const path of ['/login', '/nope']) expect(guarded(path), path).toBe(false)
  })
})
