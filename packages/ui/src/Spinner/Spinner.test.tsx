import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Spinner } from './Spinner'

describe('Spinner', () => {
  it('is a status region with a screen-reader label (English default)', () => {
    const html = renderToStaticMarkup(<Spinner />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Loading')
  })

  it('takes its label from a prop', () => {
    expect(renderToStaticMarkup(<Spinner label="불러오는 중" />)).toContain('불러오는 중')
  })
})
