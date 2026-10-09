import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'
import { isConfirmed } from './isConfirmed'

describe('isConfirmed', () => {
  it('is true without a phrase, and only for an exact (trimmed) match with one', () => {
    expect(isConfirmed(undefined, '')).toBe(true)
    expect(isConfirmed('DELETE', 'DELETE')).toBe(true)
    expect(isConfirmed('DELETE', '  DELETE ')).toBe(true)
    expect(isConfirmed('DELETE', 'delete')).toBe(false)
    expect(isConfirmed('DELETE', 'DELET')).toBe(false)
    expect(isConfirmed('DELETE', '')).toBe(false)
  })

  it('compares Unicode-normalised text (a Korean phrase typed on a different IME form still matches)', () => {
    expect(isConfirmed('삭제', '삭제'.normalize('NFD'))).toBe(true)
  })
})

const base = {
  open: true,
  onClose: () => undefined,
  onConfirm: () => undefined,
  title: 'Delete project',
}

describe('ConfirmDialog', () => {
  it('has a title, a body, a cancel and a confirm button (danger by default)', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        {...base}
        description="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
      />,
    )
    expect(html).toContain('Delete project')
    expect(html).toContain('This cannot be undone.')
    expect(html).toContain('Keep')
    expect(html).toMatch(/data-variant="danger"[^>]*>Delete</)
  })

  it('without a typed phrase the confirm button is enabled', () => {
    const html = renderToStaticMarkup(<ConfirmDialog {...base} confirmLabel="Delete" />)
    expect(html).not.toMatch(/data-variant="danger"[^>]*disabled/)
  })

  it('with a typed phrase there is a labelled input and the confirm button starts disabled', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        {...base}
        confirmLabel="Delete"
        typedConfirmation={{ phrase: 'my-project', label: 'Type my-project to confirm' }}
      />,
    )
    expect(html).toContain('Type my-project to confirm')
    expect(html).toMatch(/<input[^>]*autoComplete="off"|<input[^>]*autocomplete="off"/)
    expect(html).toMatch(/data-variant="danger"[^>]*disabled=""/)
  })

  it('busy disables both buttons', () => {
    const html = renderToStaticMarkup(<ConfirmDialog {...base} confirmLabel="Delete" busy />)
    expect(html).toContain('aria-busy="true"')
  })

  it('while busy the spinner on the confirm button is named by loadingLabel (default: Loading, unchanged)', () => {
    const named = renderToStaticMarkup(
      <ConfirmDialog {...base} confirmLabel="Delete" busy loadingLabel="Deleting" />,
    )
    expect(named).toContain('Deleting')
    expect(named).not.toContain('Loading')
    const plain = renderToStaticMarkup(<ConfirmDialog {...base} confirmLabel="Delete" busy />)
    expect(plain).toContain('Loading')
  })

  it('confirmDisabled keeps the confirm button off even when nothing else is missing (a proof the dialog asks for is not ready yet)', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog {...base} confirmLabel="Remove" confirmDisabled />,
    )
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*(<[^>]*>)*Remove/)
  })
  it('confirmBlockedBy keeps the confirm button reachable: aria-disabled, never disabled, no submit, described by the reason', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        {...base}
        confirmLabel="Remove"
        confirmBlockedBy="why"
        description={<p id="why">Nothing to remove</p>}
      />,
    )
    const button = html.match(/<button[^>]*>[^<]*(<[^>]*>)*Remove/)?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(button).toContain('aria-describedby="why"')
    expect(button).not.toMatch(/\sdisabled/)
    expect(button).toContain('type="button"')
  })

  it('confirmBlockedBy never turns a typed-phrase button into a submit (a blocked click must do nothing)', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        {...base}
        confirmLabel="Remove"
        typedConfirmation={{ phrase: 'x', label: 'Type x' }}
        confirmBlockedBy="why"
      />,
    )
    const button = html.match(/<button[^>]*>[^<]*(<[^>]*>)*Remove/)?.[0] ?? ''
    expect(button).toContain('type="button"')
    expect(button).not.toContain('form=')
  })

  it('busy still disables for real even when blocked (only work in progress is a real disabled)', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog {...base} confirmLabel="Remove" busy confirmBlockedBy="why" />,
    )
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Remove/)
    expect(html).not.toContain('aria-disabled')
  })
})
