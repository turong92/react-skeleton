import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StoredImage, videoUrlOf } from './StoredImage'

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

  it('string variants of a portrait photo get the real widths (long side fitted to the box), not the box', () => {
    const out = html({
      image: {
        width: 600,
        height: 800,
        thumb: 'https://cdn.test/t.jpg',
        display: 'https://cdn.test/d.jpg',
      },
      alt: 'x',
    })
    expect(out).toContain('srcSet="https://cdn.test/t.jpg 300w, https://cdn.test/d.jpg 600w"')
  })

  it('string variants get the module default widths (thumb 400, display 1600)', () => {
    const out = html({
      image: { thumb: 'https://cdn.test/t.jpg', display: 'https://cdn.test/d.jpg' },
      alt: 'x',
    })
    expect(out).toContain('srcSet="https://cdn.test/t.jpg 400w, https://cdn.test/d.jpg 1600w"')
  })

  it('with alternates it is a <picture>: a typed <source> per format and the <img> as fallback', () => {
    const out = html({
      image: {
        width: 3000,
        height: 2000,
        thumb,
        display,
        alternates: {
          'image/webp': {
            thumb: { url: 'https://cdn.test/t.webp', width: 400 },
            display: { url: 'https://cdn.test/d.webp', width: 1600 },
          },
        },
      },
      alt: 'cat',
      sizes: '50vw',
    })
    expect(out).toMatch(/^<picture><source type="image\/webp"[^>]*\/><img /)
    expect(out).toContain('srcSet="https://cdn.test/t.webp 400w, https://cdn.test/d.webp 1600w"')
    expect(out).toContain('sizes="50vw"')
    expect(out).toContain('src="https://cdn.test/d.jpg"')
    expect(html({ image: { thumb, display, alternates: {} }, alt: 'x' })).not.toContain('<picture')
  })

  it('a display with a video/mp4 alternate is drawn as a silent looping video (a GIF look), poster = thumb', () => {
    const out = html({
      image: {
        width: 480,
        height: 270,
        thumb,
        display: {
          url: 'https://cdn.test/d.gif',
          width: 480,
          height: 270,
          contentType: 'image/gif',
          alternates: [{ url: 'https://cdn.test/d.mp4', contentType: 'video/mp4' }],
        },
      },
      alt: 'dance',
    })
    expect(out).toContain('<video')
    expect(out).toContain('src="https://cdn.test/d.mp4"')
    expect(out).toContain('poster="https://cdn.test/t.jpg"')
    for (const attr of ['autoPlay', 'loop', 'muted', 'playsInline']) expect(out).toContain(attr)
    expect(out).toContain('aria-label="dance"')
    expect(out).toContain('width="480"')
    expect(out).not.toContain('<img')
  })

  it('a webp-only alternate (transparent animation) or none keeps the display an <img>', () => {
    const display = {
      url: 'https://cdn.test/d.gif',
      contentType: 'image/gif',
      alternates: [{ url: 'https://cdn.test/d.webp', contentType: 'image/webp' }],
    }
    const out = html({ image: { thumb, display }, alt: 'x' })
    expect(out).toContain('<img')
    expect(out).not.toContain('<video')
  })

  it('image/gif and image/webp displays stay an <img> (a thumb still lives next to them)', () => {
    const gif = { url: 'https://cdn.test/d.gif', contentType: 'image/gif' }
    const out = html({ image: { thumb, display: gif }, alt: 'x' })
    expect(out).toContain('<img')
    expect(out).toContain('src="https://cdn.test/d.gif"')
    expect(out).not.toContain('<video')
  })

  it('videoUrlOf is the one place that decides what is a video: the display video/mp4 alternate url', () => {
    const mp4 = { url: 'm', contentType: 'video/mp4' }
    expect(
      videoUrlOf({ url: 'u', alternates: [{ url: 'w', contentType: 'image/webp' }, mp4] }),
    ).toBe('m')
    expect(videoUrlOf({ url: 'u', contentType: 'video/mp4' })).toBeUndefined()
    expect(videoUrlOf({ url: 'u', alternates: [] })).toBeUndefined()
    expect(videoUrlOf({ url: 'u' })).toBeUndefined()
    expect(videoUrlOf('https://cdn.test/d.jpg')).toBeUndefined()
    expect(videoUrlOf(null)).toBeUndefined()
  })
})
