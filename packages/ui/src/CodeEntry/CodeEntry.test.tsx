import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CodeEntry } from './CodeEntry'
import { backspaceAt, digitsOf, fillFrom, isComplete } from './codeEntryState'

const props = {
  label: 'Verification code',
  digitLabel: (i: number, n: number) => `Digit ${i} of ${n}`,
  onComplete: () => undefined,
}

describe('codeEntryState', () => {
  it('digitsOf keeps only digits (a pasted "123 456" or "123-456" works)', () => {
    expect(digitsOf('123 456')).toBe('123456')
    expect(digitsOf('12-34ab')).toBe('1234')
  })

  it('fillFrom writes digits from the cell on and stops at the last cell', () => {
    expect(fillFrom(['', '', '', '', '', ''], 0, '123456')).toEqual({
      cells: ['1', '2', '3', '4', '5', '6'],
      focus: 5,
    })
    expect(fillFrom(['1', '', '', '', '', ''], 1, '23')).toEqual({
      cells: ['1', '2', '3', '', '', ''],
      focus: 3,
    })
    expect(fillFrom(['', '', '', '', '', ''], 4, '9999').cells).toEqual(['', '', '', '', '9', '9'])
  })

  it('fillFrom ignores non-digits (the cell stays where it was)', () => {
    expect(fillFrom(['', ''], 0, 'x')).toEqual({ cells: ['', ''], focus: 0 })
  })

  it('backspace clears a filled cell in place, and on an empty cell steps back and clears the previous one', () => {
    expect(backspaceAt(['1', '2', ''], 1)).toEqual({ cells: ['1', '', ''], focus: 1 })
    expect(backspaceAt(['1', '2', ''], 2)).toEqual({ cells: ['1', '', ''], focus: 1 })
    expect(backspaceAt(['', ''], 0)).toEqual({ cells: ['', ''], focus: 0 })
  })

  it('isComplete is true only when every cell has a digit', () => {
    expect(isComplete(['1', '2'])).toBe(true)
    expect(isComplete(['1', ''])).toBe(false)
  })
})

describe('CodeEntry markup', () => {
  const html = renderToStaticMarkup(<CodeEntry {...props} />).replaceAll(
    'autoComplete=',
    'autocomplete=',
  )
  it('six digit cells in a labelled group, each with its own accessible name', () => {
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Verification code"')
    for (let i = 1; i <= 6; i++) expect(html).toContain(`aria-label="Digit ${i} of 6"`)
    expect((html.match(/<input/g) ?? []).length).toBe(6)
  })

  it('mobile numeric keypad and the one-time-code suggestion on the first cell only', () => {
    expect((html.match(/inputMode="numeric"/gi) ?? []).length).toBe(6)
    expect((html.match(/autocomplete="one-time-code"/g) ?? []).length).toBe(1)
    expect((html.match(/autocomplete="off"/g) ?? []).length).toBe(5)
  })

  it('an error is announced (role=alert) and marks every cell invalid', () => {
    const out = renderToStaticMarkup(<CodeEntry {...props} error="Wrong code" />)
    expect(out).toContain('role="alert"')
    expect((out.match(/aria-invalid="true"/g) ?? []).length).toBe(6)
  })

  it('the resend button is disabled during the cooldown and says how long', () => {
    const out = renderToStaticMarkup(
      <CodeEntry
        {...props}
        resend={{
          label: 'Send again',
          onResend: () => undefined,
          secondsLeft: 12,
          waitLabel: (s) => `in ${s}s`,
        }}
      />,
    )
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Send again/)
    expect(out).toContain('in 12s')
  })

  it('busy locks the cells', () => {
    expect(
      (renderToStaticMarkup(<CodeEntry {...props} busy />).match(/disabled/g) ?? []).length,
    ).toBe(6)
  })
})
