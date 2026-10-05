import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Stepper } from './Stepper'
import { stepStatus } from './stepStatus'

const steps = [
  { id: 'account', label: 'Account' },
  { id: 'profile', label: 'Profile', description: 'Tell us about you' },
  { id: 'done', label: 'Done' },
]

describe('stepStatus', () => {
  it('is complete before the current step, current at it, upcoming after', () => {
    expect([0, 1, 2].map((i) => stepStatus(i, 1))).toEqual(['complete', 'current', 'upcoming'])
  })
})

describe('Stepper', () => {
  it('is a labelled ordered list with aria-current="step" on the current item only', () => {
    const html = renderToStaticMarkup(
      <Stepper label="Sign-up progress" steps={steps} current={1} />,
    )
    expect(html).toContain('<ol')
    expect(html).toContain('aria-label="Sign-up progress"')
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html.match(/data-status="complete"/g)).toHaveLength(1)
    expect(html.match(/data-status="upcoming"/g)).toHaveLength(1)
  })

  it('says each status in words (visually hidden), not only with colour', () => {
    const html = renderToStaticMarkup(
      <Stepper
        label="p"
        steps={steps}
        current={1}
        statusLabels={{ complete: 'Completed', current: 'Current step', upcoming: 'Not started' }}
      />,
    )
    expect(html).toContain('Completed')
    expect(html).toContain('Current step')
    expect(html).toContain('Not started')
  })

  it('shows the step number, or a check for completed steps', () => {
    const html = renderToStaticMarkup(<Stepper label="p" steps={steps} current={2} />)
    expect(html).toContain('✓')
    expect(html).toContain('>3<')
  })

  it('completed steps are buttons only when onStepSelect is given', () => {
    expect(renderToStaticMarkup(<Stepper label="p" steps={steps} current={2} />)).not.toContain(
      '<button',
    )
    const html = renderToStaticMarkup(
      <Stepper label="p" steps={steps} current={2} onStepSelect={() => undefined} />,
    )
    expect(html.match(/<button/g)).toHaveLength(2)
  })
})
