import { RequireAuth, RequirePermission } from '@skeleton/auth'
import { isValidElement, type ReactElement } from 'react'
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
    expect(leaf('/forgot-id')?.path).toBe('/forgot-id') // 아이디 찾기 - 로그인 아이디를 켠 백엔드(발견)일 때의 화면
    expect(leaf('/reset-password')?.path).toBe('/reset-password')
    expect(leaf('/magic-link')?.path).toBe('/magic-link')
    // old mailed links (now codes) land on one friendly page instead of a 404
    for (const old of ['/confirm-email-change', '/confirm-reauth', '/confirm-delete'])
      expect(leaf(old)?.path, old).toBe(old)
    expect(leaf('/account')?.path).toBe('/account')
    expect(leaf('/admin/accounts')?.path).toBe('/admin/accounts')
    expect(leaf('/terms')?.path).toBe('/terms')
    expect(leaf('/privacy')?.path).toBe('/privacy')
    expect(leaf('/refund')?.path).toBe('/refund')
    expect(leaf('/nope/nope')?.path).toBe('*')
  })

  it('has the cheer journey: choose (/cheer), come back from the payment window (/payments/return), my cheers (/cheers), one payment (/payments/:id)', () => {
    expect(leaf('/cheer')?.path).toBe('/cheer')
    // 정적 경로가 `:id` 보다 먼저 맞는다 — 결제창이 돌아오는 주소가 결제 한 건으로 읽히지 않는다
    expect(leaf('/payments/return')?.path).toBe('/payments/return')
    expect(leaf('/cheers')?.path).toBe('/cheers')
    expect(leaf('/payments/ord_abc')?.path).toBe('/payments/:id')
  })

  it('has the subscription journey: plans (/subscribe), back from the card window (/subscriptions/return), my subscription (/subscription) — all behind sign-in', () => {
    expect(leaf('/subscribe')?.path).toBe('/subscribe')
    expect(leaf('/subscriptions/return')?.path).toBe('/subscriptions/return')
    expect(leaf('/subscription')?.path).toBe('/subscription')
    for (const path of ['/subscribe', '/subscriptions/return', '/subscription'])
      expect(guarded(path), path).toBe(true)
  })

  it('has the operator payment screens: the list (/admin/payments) and one payment (/admin/payments/:id)', () => {
    expect(leaf('/admin/payments')?.path).toBe('/admin/payments')
    expect(leaf('/admin/payments/ord_abc')?.path).toBe('/admin/payments/:id')
  })

  it('the operator screens sit under the auth guard and, inside it, a permission guard of their own - payments need payment.read, accounts need account.read', () => {
    const permissionsOf = (path: string) =>
      chain(path)
        .filter(
          (route) => isValidElement(route.element) && route.element.type === RequirePermission,
        )
        .map((route) => (route.element as ReactElement<{ anyOf: string[] }>).props.anyOf)
    for (const path of ['/admin/payments', '/admin/payments/ord_abc']) {
      expect(guarded(path), path).toBe(true)
      expect(permissionsOf(path), path).toEqual([['payment.read']])
    }
    expect(guarded('/admin/accounts')).toBe(true)
    expect(permissionsOf('/admin/accounts')).toEqual([['account.read']])
    expect(guarded('/admin/roles')).toBe(true)
    expect(permissionsOf('/admin/roles')).toEqual([['authz.roles']])
    // 사용자 쪽 결제 화면에는 권한 가드가 없다
    for (const path of ['/cheer', '/cheers', '/payments/ord_abc'])
      expect(permissionsOf(path), path).toEqual([])
  })

  it('the signed-in screens sit under the auth guard; home, login, the legal pages, the board and the 404 are public', () => {
    for (const path of [
      '/notes',
      '/notes/new',
      '/notes/abc',
      '/notes/abc/edit',
      '/account',
      '/admin/accounts',
      '/settings',
      '/cheer',
      '/payments/return',
      '/cheers',
      '/payments/ord_abc',
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
      '/forgot-id',
      '/magic-link',
      '/terms',
      '/privacy',
      '/refund',
      '/nope',
      // 게시판은 비회원도 읽고(서버 allow-anonymous-read) 게시판이 허락하면 쓴다 - 화면이 로그인 여부로 가린다
      '/board',
      '/board/new',
      '/board/abc',
      '/board/abc/edit',
    ])
      expect(guarded(path), path).toBe(false)
  })

  it('every route says how it appears to search engines (handle.seo): the landing and the legal pages are indexable; the login page, everything behind it and the 404 are not', () => {
    const seoOf = (path: string) =>
      (chain(path).at(-1)!.handle as { seo?: { indexable: boolean } } | undefined)?.seo
    for (const path of ['/', '/terms', '/privacy', '/refund'])
      expect(seoOf(path)?.indexable, path).toBe(true)
    for (const path of [
      '/login',
      '/sign-up',
      '/verify-email',
      '/forgot-password',
      '/forgot-id',
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
      '/cheer',
      '/payments/return',
      '/cheers',
      '/payments/ord_abc',
    ])
      expect(seoOf(path)?.indexable, path).toBe(false)
    expect(seoOf('/nope')?.indexable).toBe(false)
  })
})
