import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LanguageMenu } from './LanguageMenu'

const options = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
]

describe('LanguageMenu', () => {
  it('is a labelled native select with one option per language, the current one selected', () => {
    const html = renderToStaticMarkup(
      <LanguageMenu label="Language" value="en" options={options} onChange={() => {}} />,
    )
    expect(html).toMatch(/<select[^>]*aria-label="Language"/)
    expect(html).toContain('<option value="en" lang="en" selected="">English</option>')
    expect(html).toContain('<option value="ko" lang="ko">한국어</option>')
  })

  it('marks the language of the control and of each option so a screen reader pronounces them right', () => {
    const html = renderToStaticMarkup(
      <LanguageMenu label="언어" value="ko" options={options} onChange={() => {}} />,
    )
    expect(html).toMatch(/<select[^>]*lang="ko"/)
    expect(html).toContain('lang="en"')
  })

  it('the globe icon is decorative', () => {
    const html = renderToStaticMarkup(
      <LanguageMenu label="Language" value="ko" options={options} onChange={() => {}} />,
    )
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
  })
})
