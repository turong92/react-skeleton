import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FaqList, type FaqSection } from './FaqList'

const sections: FaqSection[] = [
  {
    id: 'start',
    title: 'Getting started',
    items: [
      { id: 'a', question: 'How do I begin?', answer: <p>Open the app.</p> },
      { id: 'b', question: 'Is it free?', answer: 'Yes.' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    items: [{ id: 'c', question: 'Refunds?', answer: 'Ask us.' }],
  },
]

describe('FaqList', () => {
  const html = renderToStaticMarkup(<FaqList sections={sections} />)

  it('labels each section by its heading and folds every question closed', () => {
    expect(html).toContain('aria-labelledby="faq-start"')
    expect(html).toMatch(/<h2 id="faq-start"[^>]*>Getting started<\/h2>/)
    expect(html.match(/<details/g)).toHaveLength(3)
    expect(html).not.toContain('<details open')
    expect(html).toMatch(/<summary[^>]*>How do I begin\?<\/summary>/)
  })

  it('renders the answer a question carries — text or markup', () => {
    expect(html).toContain('<p>Open the app.</p>')
    expect(html).toContain('>Yes.<')
  })
})
