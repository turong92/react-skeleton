import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LegalDocumentPage } from './LegalDocumentPage'
import type { LegalVersion } from './versions'

const versions: LegalVersion[] = [
  {
    version: '1.0',
    effectiveDate: '2025-01-01',
    markdown: '# Old terms\n\nOld text for {{company}}.',
  },
  {
    version: '2.0',
    effectiveDate: '2026-10-01',
    markdown: '# New terms\n\nNew text for {{company}}.',
  },
]
const base = {
  title: 'Terms of Service',
  versions,
  today: '2026-10-06',
  locale: 'en-US',
  facts: { company: 'Acme' },
}

describe('LegalDocumentPage', () => {
  it('shows the title as the h1, the current version, its effective date and its text with the facts filled in', () => {
    const html = renderToStaticMarkup(
      <LegalDocumentPage
        {...base}
        labels={{ version: (v) => `Version ${v}`, effective: (date) => `Effective ${date}` }}
      />,
    )
    expect(html).toMatch(/<h1[^>]*>Terms of Service<\/h1>/)
    expect(html).toContain('Version 2.0')
    expect(html).toContain('Effective October 1, 2026')
    expect(html).toContain('New text for Acme.')
    expect(html).not.toContain('Old text')
    // 본문 제목은 h1 아래
    expect(html).toMatch(/<h2[^>]*>New terms<\/h2>/)
  })

  it('offers a version switcher (a labelled select, newest first) only when there is more than one version', () => {
    const html = renderToStaticMarkup(
      <LegalDocumentPage {...base} labels={{ switcher: 'Version' }} />,
    )
    expect(html).toContain('<select')
    expect(html).toContain('Version')
    expect(html.indexOf('2.0')).toBeLessThan(html.indexOf('1.0'))
    expect(
      renderToStaticMarkup(<LegalDocumentPage {...base} versions={[versions[1]]} />),
    ).not.toContain('<select')
  })

  it('an older selected version carries a notice that it is not the current one, with a way back', () => {
    const html = renderToStaticMarkup(
      <LegalDocumentPage
        {...base}
        selectedVersion="1.0"
        onVersionChange={() => undefined}
        labels={{
          olderNotice: (current) => `Not current — version ${current} applies`,
          viewCurrent: 'Read the current version',
        }}
      />,
    )
    expect(html).toContain('Old text for Acme.')
    expect(html).toContain('Not current — version 2.0 applies')
    expect(html).toContain('Read the current version')
  })

  it('a version that has not taken effect yet says so', () => {
    const html = renderToStaticMarkup(
      <LegalDocumentPage
        {...base}
        versions={[
          ...versions,
          { version: '3.0', effectiveDate: '2027-03-01', markdown: 'Future' },
        ]}
        selectedVersion="3.0"
        onVersionChange={() => undefined}
        labels={{ upcomingNotice: (date) => `Takes effect ${date}` }}
      />,
    )
    expect(html).toContain('Takes effect March 1, 2027')
  })

  it('a template notice (this is a template, not legal advice) is shown above the document when given', () => {
    expect(
      renderToStaticMarkup(
        <LegalDocumentPage {...base} templateNotice="TEMPLATE — have a lawyer review this" />,
      ),
    ).toContain('TEMPLATE — have a lawyer review this')
  })

  it('placeholders without a fact stay visibly marked', () => {
    expect(renderToStaticMarkup(<LegalDocumentPage {...base} facts={{}} />)).toContain(
      'data-missing="company"',
    )
  })
})
