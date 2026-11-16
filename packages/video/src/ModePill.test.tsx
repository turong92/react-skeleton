import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultVideoPlayerLabels } from './labels'
import { ModePill } from './ModePill'

const html = (mode: 'video' | 'audio') =>
  renderToStaticMarkup(
    <ModePill labels={defaultVideoPlayerLabels} mode={mode} onChange={() => {}} />,
  )

describe('ModePill', () => {
  it('keeps the accessible names: a radio group named labels.mode with one radio per label', () => {
    const out = html('video')
    expect(out).toContain(`role="radiogroup"`)
    expect(out).toContain(`aria-label="${defaultVideoPlayerLabels.mode}"`)
    expect(out).toMatch(
      new RegExp(`<button[^>]*role="radio"[^>]*>(?:<[^>]*>)*${defaultVideoPlayerLabels.modeVideo}`),
    )
    expect(out).toContain(defaultVideoPlayerLabels.modeAudio)
  })

  it('marks only the chosen one checked, and only it is reachable by Tab', () => {
    const out = html('audio')
    const buttons = out.match(/<button[^>]*>/g) ?? []
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toContain('aria-checked="false"')
    expect(buttons[0]).toContain('tabindex="-1"')
    expect(buttons[1]).toContain('aria-checked="true"')
    expect(buttons[1]).toContain('tabindex="0"')
  })

  it('looks pressable: bordered and filled at rest, at least 32px tall, hover and focus-visible differ', () => {
    const css = readFileSync(new URL('./ModePill.module.css', import.meta.url), 'utf8')
    const segment = css.match(/\.segment\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(segment).toMatch(/border:\s*1px solid/)
    expect(segment).toMatch(/background:\s*var\(--surface\)/)
    expect(Number(segment.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(32)
    expect(css).toMatch(/\.segment:hover/)
    expect(css).toMatch(/\.segment:focus-visible/)
    expect(css).toMatch(/\.segment\[aria-checked='true'\]/)
  })
})
