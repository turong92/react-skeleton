import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tabs } from './Tabs'

const items = [
  { id: 'one', label: 'One', content: <p>first body</p> },
  { id: 'two', label: 'Two', content: <p>second body</p> },
  { id: 'three', label: 'Three', content: <p>third body</p>, disabled: true },
]

describe('Tabs', () => {
  it('renders a labelled tablist of role="tab" buttons and the panels', () => {
    const html = renderToStaticMarkup(<Tabs aria-label="Sections" items={items} />)
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Sections"')
    expect(html.match(/role="tab"/g)).toHaveLength(3)
    expect(html.match(/role="tabpanel"/g)).toHaveLength(3)
  })

  it('selects defaultValue (else the first enabled tab): aria-selected, roving tabindex, only its panel visible', () => {
    const html = renderToStaticMarkup(<Tabs aria-label="s" items={items} defaultValue="two" />)
    const tabs = html.match(/<button[^>]*role="tab"[^>]*>/g)!
    expect(tabs[0]).toContain('aria-selected="false"')
    expect(tabs[0]).toContain('tabindex="-1"')
    expect(tabs[1]).toContain('aria-selected="true"')
    expect(tabs[1]).toContain('tabindex="0"')
    const panels = html.match(/<div[^>]*role="tabpanel"[^>]*>/g)!
    expect(panels[0]).toContain('hidden=""')
    expect(panels[1]).not.toContain('hidden=""')
    const first = renderToStaticMarkup(<Tabs aria-label="s" items={items} />)
    expect(first.match(/<button[^>]*role="tab"[^>]*>/g)![0]).toContain('aria-selected="true"')
  })

  it('ties each tab to its panel with aria-controls / aria-labelledby', () => {
    const html = renderToStaticMarkup(<Tabs aria-label="s" items={items} />)
    const tab = /<button[^>]*role="tab"[^>]*>/.exec(html)![0]
    const tabId = /\bid="([^"]+)"/.exec(tab)![1]
    const controls = /aria-controls="([^"]+)"/.exec(tab)![1]
    const panel = new RegExp(`<div[^>]*id="${controls}"[^>]*>`).exec(html)![0]
    expect(panel).toContain(`aria-labelledby="${tabId}"`)
  })

  it('a controlled value wins and a disabled tab is disabled', () => {
    const html = renderToStaticMarkup(
      <Tabs aria-label="s" items={items} value="two" onValueChange={() => {}} />,
    )
    expect(html.match(/<button[^>]*role="tab"[^>]*>/g)![1]).toContain('aria-selected="true"')
    expect(html.match(/<button[^>]*role="tab"[^>]*>/g)![2]).toContain('disabled=""')
  })

  it('the tab buttons are type="button" so they never submit a form', () => {
    expect(renderToStaticMarkup(<Tabs aria-label="s" items={items} />)).not.toContain(
      'type="submit"',
    )
    expect(renderToStaticMarkup(<Tabs aria-label="s" items={items} />)).toContain('type="button"')
  })
})
