import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StoredImage } from './StoredImage'

const thumb = { url: 'https://cdn.test/t.jpg', width: 400, height: 267 }
const display = { url: 'https://cdn.test/d.jpg', width: 1600, height: 1067 }
const html = (props: Parameters<typeof StoredImage>[0]) =>
  renderToStaticMarkup(<StoredImage {...props} />)

describe('StoredImage', () => {
  it('draws display as src with a thumb/display srcset, the size reserved and lazy', () => {
    const out = html({
      image: { width: 3000, height: 2000, thumb, display },
      alt: 'cat',
      sizes: '50vw',
    })
    expect(out).toContain('src="https://cdn.test/d.jpg"')
    expect(out).toContain('srcSet="https://cdn.test/t.jpg 400w, https://cdn.test/d.jpg 1600w"')
    expect(out).toContain('sizes="50vw"')
    expect(out).toContain('width="3000"')
    expect(out).toContain('height="2000"')
    expect(out).toContain('loading="lazy"')
    expect(out).toContain('decoding="async"')
    expect(out).toContain('alt="cat"')
  })

  it('with one variant only it is a plain src (no srcset) — url strings work too (board attachmentImages)', () => {
    const out = html({
      image: { width: 800, height: 600, thumb: 'https://cdn.test/t.jpg' },
      alt: '',
    })
    expect(out).toContain('src="https://cdn.test/t.jpg"')
    expect(out).not.toContain('srcSet')
  })

  it('without width and height it leaves them out; without any variant it draws nothing', () => {
    const out = html({ image: { display }, alt: 'x' })
    expect(out).not.toMatch(/ width=/)
    expect(out).not.toMatch(/ height=/)
    expect(html({ image: { width: 1, height: 1 }, alt: 'x' })).toBe('')
  })

  it('string variants get the module default widths (thumb 400, display 1600)', () => {
    const out = html({
      image: { thumb: 'https://cdn.test/t.jpg', display: 'https://cdn.test/d.jpg' },
      alt: 'x',
    })
    expect(out).toContain('srcSet="https://cdn.test/t.jpg 400w, https://cdn.test/d.jpg 1600w"')
  })
})
