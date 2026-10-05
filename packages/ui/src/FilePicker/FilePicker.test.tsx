import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FilePicker } from './FilePicker'

const base = { title: 'Attach a file', buttonLabel: 'Choose file', onFiles: () => undefined }

describe('FilePicker', () => {
  it('is a named group with a native file input and a button that opens it', () => {
    const html = renderToStaticMarkup(<FilePicker {...base} accept="image/*" hint="Up to 5 MB" />)
    expect(html).toMatch(/role="group"[^>]*aria-labelledby/)
    expect(html).toContain('Attach a file')
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="image\/\*"/)
    expect(html).toContain('tabindex="-1"')
    expect(html).toMatch(/<button[^>]*>Choose file<\/button>/)
    expect(html).toContain('Up to 5 MB')
  })

  it('announces an error and links it with aria-describedby', () => {
    const html = renderToStaticMarkup(<FilePicker {...base} invalid error="Too large" />)
    expect(html).toMatch(/role="alert"[^>]*>Too large</)
    expect(html).toMatch(/aria-describedby="[^"]+"/)
    expect(html).toContain('data-invalid="true"')
  })

  it('disabled disables the input and the button', () => {
    const html = renderToStaticMarkup(<FilePicker {...base} disabled />)
    expect(html.match(/disabled=""/g)?.length).toBe(2)
  })
})
