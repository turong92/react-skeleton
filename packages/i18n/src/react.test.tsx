import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createI18n } from './createI18n'
import { I18nProvider, useT } from './react'

const ko = { greet: '안녕하세요, {name}님', bold: '<b>중요</b> 안내' }
const en = { greet: 'Hello, {name}', bold: '<b>Important</b> notice' }
const make = () =>
  createI18n({ catalogs: { ko, en }, defaultLocale: 'ko', storageKey: 'k', storage: null })

function Probe() {
  const { t, tRich, locale, locales, localeOptions } = useT()
  return (
    <div>
      <p>{t('greet', { name: 'Ada' })}</p>
      <p>{tRich('bold', { b: (chunks) => <strong>{chunks}</strong> })}</p>
      <p>{locale}</p>
      <p>{locales.join(',')}</p>
      <p>{localeOptions.map((o) => `${o.value}=${o.label}`).join(';')}</p>
    </div>
  )
}

describe('useT / I18nProvider', () => {
  it('reads the instance from the provider and renders the default locale on the server', () => {
    const html = renderToStaticMarkup(
      <I18nProvider i18n={make()}>
        <Probe />
      </I18nProvider>,
    )
    expect(html).toContain('<p>안녕하세요, Ada님</p>')
    expect(html).toContain('<p><strong>중요</strong> 안내</p>')
    expect(html).toContain('<p>ko</p>')
    expect(html).toContain('<p>ko,en</p>')
  })

  it('offers the locales with their own names for a language menu', () => {
    const html = renderToStaticMarkup(
      <I18nProvider i18n={make()}>
        <Probe />
      </I18nProvider>,
    )
    expect(html).toContain('<p>ko=한국어;en=English</p>')
  })

  it('takes the instance as an argument when there is no provider', () => {
    function Bare() {
      return <p>{useT(make()).t('greet', { name: 'Ada' })}</p>
    }
    expect(renderToStaticMarkup(<Bare />)).toBe('<p>안녕하세요, Ada님</p>')
  })

  it('without a provider or an instance it says what to do instead of failing obscurely', () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(/I18nProvider/)
  })
})
