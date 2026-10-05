import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SectionCard } from './SectionCard'

describe('SectionCard', () => {
  it('is a labelled section with an anchor id and a focusable heading (the section index can move focus there)', () => {
    const html = renderToStaticMarkup(
      <SectionCard id="profile" title="Profile">
        body
      </SectionCard>,
    )
    expect(html).toMatch(/<section[^>]*id="profile"/)
    expect(html).toContain('aria-labelledby="profile-title"')
    expect(html).toMatch(/<h2[^>]*id="profile-title"[^>]*tabindex="-1"/)
    expect(html).toContain('body')
  })

  it('headingLevel 3 renders an h3, the description is the section description', () => {
    const html = renderToStaticMarkup(
      <SectionCard id="a" title="A" headingLevel={3} description="About A">
        x
      </SectionCard>,
    )
    expect(html).toContain('<h3')
    expect(html).toContain('aria-describedby="a-description"')
    expect(html).toContain('id="a-description"')
  })

  it('collapsible: the heading holds a toggle button with aria-expanded/aria-controls, the panel stays mounted but hidden when collapsed', () => {
    const html = renderToStaticMarkup(
      <SectionCard id="s" title="Security" collapsible defaultExpanded={false} summary="2 devices">
        panel content
      </SectionCard>,
    )
    expect(html).toMatch(/<h2[^>]*><button[^>]*aria-expanded="false"[^>]*aria-controls="s-panel"/)
    expect(html).toMatch(/<div[^>]*id="s-panel"[^>]*hidden=""/)
    expect(html).toContain('panel content')
    expect(html).toContain('2 devices')
  })

  it('collapsible and expanded: no hidden panel, the summary is not shown, the description is', () => {
    const html = renderToStaticMarkup(
      <SectionCard
        id="s"
        title="Security"
        collapsible
        description="Keep it safe"
        summary="2 devices"
      >
        panel content
      </SectionCard>,
    )
    expect(html).toContain('aria-expanded="true"')
    expect(html).not.toMatch(/id="s-panel"[^>]*hidden/)
    expect(html).not.toContain('2 devices')
    expect(html).toContain('Keep it safe')
  })

  it('a controlled expanded value wins over defaultExpanded', () => {
    const html = renderToStaticMarkup(
      <SectionCard
        id="s"
        title="T"
        collapsible
        expanded={false}
        defaultExpanded
        onToggle={() => {}}
      >
        x
      </SectionCard>,
    )
    expect(html).toContain('aria-expanded="false"')
  })

  it('aside is shown next to the title', () => {
    const html = renderToStaticMarkup(
      <SectionCard id="s" title="T" aside={<span>3 items</span>}>
        x
      </SectionCard>,
    )
    expect(html).toContain('3 items')
  })
})
