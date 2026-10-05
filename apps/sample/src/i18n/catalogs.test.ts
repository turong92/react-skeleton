import { catalogProblems } from '@skeleton/i18n/testing'
import { describe, expect, it } from 'vitest'
import ko from './ko'

describe('the Notes catalogs', () => {
  it('ko and en have the same keys, valid ICU and the same arguments', async () => {
    expect(
      await catalogProblems({ ko, en: () => import('./en') }, { defaultLocale: 'ko' }),
    ).toEqual([])
  })

  it('the parity check really sees a drifting translation (guard against a vacuous pass)', async () => {
    const { default: en } = await import('./en')
    const drifted = { ...en, 'dashboard.greeting': 'Hello', 'login.title': 'Sign in {oops}' }
    const problems = await catalogProblems({ ko, en: drifted }, { defaultLocale: 'ko' })
    expect([...problems].sort()).toEqual([
      'en "dashboard.greeting": does not use {name}, which ko does',
      'en "login.title": uses {oops}, which ko does not',
    ])
  })
})
