import { isValidElement } from 'react'
import { matchRoutes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../appName'
import { ClientRequireAuth } from '../auth/ClientRequireAuth'
import { documentMeta, handleOf, routeMatches } from './routeMeta'
import { routes } from './routes'

const leaf = (path: string) => matchRoutes(routes, path)?.at(-1)?.route

describe('routes', () => {
  it('has a home page, a login page, an account page and a 404 catch-all (the same pages as the SPA starter)', () => {
    expect(leaf('/')?.path).toBe('/')
    expect(leaf('/login')?.path).toBe('/login')
    expect(leaf('/account')?.path).toBe('/account')
    expect(leaf('/definitely/not/here')?.path).toBe('*')
  })

  it('/account sits under the hydration-safe auth guard, / and /login do not', () => {
    const guarded = (path: string) =>
      matchRoutes(routes, path)!.some(
        ({ route }) => isValidElement(route.element) && route.element.type === ClientRequireAuth,
      )
    expect(guarded('/account')).toBe(true)
    expect(guarded('/')).toBe(false)
    expect(guarded('/login')).toBe(false)
  })
})

describe('route metadata — title, description and first-render data live next to the route', () => {
  it('every page has its own title and description', () => {
    const metas = ['/', '/login', '/account', '/nope'].map((path) =>
      documentMeta(routeMatches(routes, path)),
    )
    for (const meta of metas) {
      expect(meta.title.length).toBeGreaterThan(0)
      expect(meta.description.length).toBeGreaterThan(0)
    }
    expect(new Set(metas.map((meta) => meta.title)).size).toBe(metas.length)
    expect(metas[0].title).toBe(`홈 · ${APP_NAME}`)
  })

  it('the account page and the 404 page ask search engines not to index them; the home page does not', () => {
    expect(documentMeta(routeMatches(routes, '/account')).robots).toBe('noindex')
    expect(documentMeta(routeMatches(routes, '/nope')).robots).toBe('noindex')
    expect(documentMeta(routeMatches(routes, '/')).robots).toBeUndefined()
  })

  it('only the home page prefetches (the hello example) — the protected page fetches nothing on the server', () => {
    expect(typeof handleOf(leaf('/')!)?.prefetch).toBe('function')
    expect(handleOf(leaf('/account')!)?.prefetch).toBeUndefined()
    expect(handleOf(leaf('/nope')!)?.prefetch).toBeUndefined()
  })

  it('routeMatches says "no match" for a path outside the table as an empty list (the catch-all matches everything else)', () => {
    expect(routeMatches([{ path: '/only', element: null }], '/other')).toEqual([])
  })
})
