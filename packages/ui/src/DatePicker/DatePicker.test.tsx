import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DatePicker } from './DatePicker'
import { DateRangePicker } from './DateRangePicker'

describe('DatePicker', () => {
  it('is a native date input carrying value, min and max, and the Field wiring', () => {
    const html = renderToStaticMarkup(
      <DatePicker
        id="d"
        value="2026-10-06"
        onChange={() => undefined}
        min="2026-10-01"
        max="2026-10-31"
        aria-describedby="hint"
        invalid
      />,
    )
    expect(html).toContain('type="date"')
    expect(html).toContain('value="2026-10-06"')
    expect(html).toContain('min="2026-10-01"')
    expect(html).toContain('max="2026-10-31"')
    expect(html).toContain('id="d"')
    expect(html).toContain('aria-describedby="hint"')
    expect(html).toContain('aria-invalid="true"')
  })

  it("echoes the chosen day in the reader's language (calendar date: no time-zone shift), politely announced", () => {
    const html = renderToStaticMarkup(
      <DatePicker value="1998-03-05" onChange={() => undefined} locale="ko-KR" />,
    )
    expect(html).toContain('1998년 3월 5일')
    expect(html).toContain('aria-live="polite"')
    expect(
      renderToStaticMarkup(<DatePicker value="" onChange={() => undefined} locale="ko-KR" />),
    ).not.toContain('년')
  })

  it('a "today" button only when it has a label', () => {
    expect(renderToStaticMarkup(<DatePicker value="" onChange={() => undefined} />)).not.toContain(
      '<button',
    )
    expect(
      renderToStaticMarkup(<DatePicker value="" onChange={() => undefined} todayLabel="Today" />),
    ).toContain('Today')
  })
})

describe('DateRangePicker', () => {
  const base = { legend: 'Stay', startLabel: 'From', endLabel: 'To', onChange: () => undefined }

  it('is a fieldset with a legend and two date inputs bounded by each other', () => {
    const html = renderToStaticMarkup(
      <DateRangePicker {...base} value={{ start: '2026-10-06', end: '2026-10-09' }} />,
    )
    expect(html).toContain('<fieldset')
    expect(html).toContain('<legend')
    expect(html.match(/type="date"/g)).toHaveLength(2)
    expect(html).toMatch(/max="2026-10-09"/)
    expect(html).toMatch(/min="2026-10-06"/)
  })

  it('an end before the start is announced as an error on the end field', () => {
    const html = renderToStaticMarkup(
      <DateRangePicker
        {...base}
        value={{ start: '2026-10-09', end: '2026-10-06' }}
        orderMessage="End must be after start"
      />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('End must be after start')
  })

  it('a valid range is summarised "start – end"', () => {
    const html = renderToStaticMarkup(
      <DateRangePicker
        {...base}
        value={{ start: '2026-10-06', end: '2026-10-09' }}
        locale="en-US"
      />,
    )
    expect(html).toContain('October 6, 2026 – October 9, 2026')
  })
})
