import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { LegalPage } from './LegalPage'

afterEach(() => i18n.setLocale('ko', { remember: false }))

const render = (doc: 'terms' | 'privacy', search = '') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/${doc}${search}`]}>
      <LegalPage doc={doc} />
    </MemoryRouter>,
  )

describe('/terms and /privacy (LegalPage)', () => {
  it('shows the document title as the h1, a loud TEMPLATE notice, the version and the switcher', () => {
    const html = render('terms')
    expect(html).toMatch(new RegExp(`<h1[^>]*>${i18n.t('legal.terms.title')}</h1>`))
    expect(html).toContain(i18n.t('legal.templateNotice'))
    expect(html).toContain('<select')
    expect(html).not.toContain('data-missing') // 채워진 문서
  })

  it('privacy has its own title', () => {
    expect(render('privacy')).toContain(i18n.t('legal.privacy.title'))
  })

  it('the version in the address (?v=) is the one shown, so a link points at a version', () => {
    const html = render('terms', '?v=1.0')
    expect(html).toContain(i18n.t('legal.older', { current: '2.0' }))
  })

  it('an unknown ?v= falls back to the current version instead of an empty page', () => {
    expect(render('terms', '?v=9.9')).toContain(i18n.t('legal.terms.title'))
    expect(render('terms', '?v=9.9')).not.toContain(i18n.t('legal.older', { current: '2.0' }))
  })

  it('English readers get the English document and notice', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render('terms')
    expect(html).toContain('Terms of Service')
    expect(html).toContain('TEMPLATE')
  })
})
