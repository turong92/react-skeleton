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
  it('has every screen of the journey: home (landing or dashboard), notes, board, settings, login, the legal pages, 404', () => {
    expect(leaf('/')?.path).toBe('/')
    expect(leaf('/notes')?.path).toBe('/notes')
    expect(leaf('/notes/new')?.path).toBe('/notes/new')
    expect(leaf('/notes/abc')?.path).toBe('/notes/:id')
    expect(leaf('/notes/abc/edit')?.path).toBe('/notes/:id/edit')
    expect(leaf('/settings')?.path).toBe('/settings')
    expect(leaf('/board')?.path).toBe('/board')
    expect(leaf('/board/new')?.path).toBe('/board/new')
    expect(leaf('/board/p1')?.path).toBe('/board/:id')
    expect(leaf('/board/p1/edit')?.path).toBe('/board/:id/edit')
    expect(leaf('/login')?.path).toBe('/login')
    expect(leaf('/sign-up')?.path).toBe('/sign-up')
    expect(leaf('/verify-email')?.path).toBe('/verify-email')
    expect(leaf('/forgot-password')?.path).toBe('/forgot-password')
    expect(leaf('/reset-password')?.path).toBe('/reset-password')
    expect(leaf('/magic-link')?.path).toBe('/magic-link')
    // old mailed links (now codes) land on one friendly page instead of a 404
    for (const old of ['/confirm-email-change', '/confirm-reauth', '/confirm-delete'])
      expect(leaf(old)?.path, old).toBe(old)
    expect(leaf('/account')?.path).toBe('/account')
    expect(leaf('/admin/accounts')?.path).toBe('/admin/accounts')
    expect(leaf('/terms')?.path).toBe('/terms')
    expect(leaf('/privacy')?.path).toBe('/privacy')
    expect(leaf('/nope/nope')?.path).toBe('*')
  })

  it('the signed-in screens sit under the auth guard; home, login, the legal pages and the 404 are public', () => {
    for (const path of [
      '/notes',
      '/notes/new',
      '/notes/abc',
      '/notes/abc/edit',
      '/board',
      '/board/new',
      '/board/abc',
      '/account',
      '/admin/accounts',
      '/board/abc/edit',
      '/settings',
    ])
      expect(guarded(path), path).toBe(true)
    for (const path of [
      '/',
      '/login',
      '/sign-up',
      '/verify-email',
      '/confirm-email-change',
      '/confirm-reauth',
      '/confirm-delete',
      '/forgot-password',
      '/magic-link',
      '/terms',
      '/privacy',
      '/nope',
    ])
      expect(guarded(path), path).toBe(false)
  })

  it('every route says how it appears to search engines (handle.seo): the landing and the legal pages are indexable; the login page, everything behind it and the 404 are not', () => {
    const seoOf = (path: string) =>
      (chain(path).at(-1)!.handle as { seo?: { indexable: boolean } } | undefined)?.seo
    for (const path of ['/', '/terms', '/privacy']) expect(seoOf(path)?.indexable, path).toBe(true)
    for (const path of [
      '/login',
      '/sign-up',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
      '/magic-link',
      '/account',
      '/confirm-email-change',
      '/confirm-reauth',
      '/confirm-delete',
      '/notes',
      '/notes/new',
      '/board',
      '/board/p1',
      '/settings',
    ])
      expect(seoOf(path)?.indexable, path).toBe(false)
    expect(seoOf('/nope')?.indexable).toBe(false)
  })
})
