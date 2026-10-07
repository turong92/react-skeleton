import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * 눌리는 것은 한눈에 눌리는 것으로 보인다 — 쉬는 상태에서도 테두리나 채움이 있다(글자만 있는 버튼 금지).
 * 정말 인라인 링크여야 하는 것은 `link` 변형(밑줄 + 링크색). 스타일 파일을 읽어 단정한다.
 */
const css = readFileSync(new URL('./Button.module.css', import.meta.url), 'utf8')

/** `selector { … }` 의 본문(여러 규칙이면 이어 붙인다). 미디어 쿼리 안은 `media` 로 */
function body(selector: string, within = css): string {
  const escaped = selector.replace(/[.[\]()':>*+~^$|\\]/g, '\\$&')
  const rules = [...within.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
  return rules.map((m) => m[1]).join('\n')
}
const value = (text: string, property: string) =>
  text.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1].trim()
const px = (text: string | undefined) => Number(text?.replace('px', ''))

const FILLED_OR_OUTLINED = ['primary', 'secondary', 'ghost', 'danger'] as const

describe('Button affordance', () => {
  it.each(FILLED_OR_OUTLINED)('%s has a visible border or fill while resting', (variant) => {
    const rule = body(`.button[data-variant='${variant}']`)
    const border = value(rule, 'border-color')
    const background = value(rule, 'background')
    const borderVisible = border !== undefined && border !== 'transparent'
    const fillVisible = background !== undefined && background !== 'transparent'
    expect(
      borderVisible || fillVisible,
      `${variant}: border=${border} background=${background}`,
    ).toBe(true)
  })

  it('the link variant is for inline links: underlined, in the link colour, and not boxed', () => {
    const rule = body(`.button[data-variant='link']`)
    expect(value(rule, 'text-decoration')).toMatch(/underline/)
    expect(value(rule, 'color')).toBe('var(--teal)')
  })

  it('touch targets: md is at least 44px tall, sm at least 36px (44px on coarse pointers)', () => {
    expect(px(value(body('.button'), 'min-height'))).toBeGreaterThanOrEqual(44)
    expect(px(value(body(`.button[data-size='sm']`), 'min-height'))).toBeGreaterThanOrEqual(36)
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(px(value(body(`.button[data-size='sm']`, coarse), 'min-height'))).toBeGreaterThanOrEqual(
      44,
    )
  })

  it('every state is distinguishable: hover, active, focus-visible, and a dimmed disabled', () => {
    expect(body(`.button[data-variant='ghost']:hover:not(:disabled)`)).not.toBe('')
    expect(body('.button:active:not(:disabled)')).not.toBe('')
    expect(body('.button:focus-visible')).toMatch(/outline/)
    expect(value(body('.button:disabled'), 'opacity')).toBeDefined()
    expect(value(body('.button'), 'cursor')).toBe('pointer')
    expect(value(body('.button:disabled'), 'cursor')).toBe('not-allowed')
  })
})

describe('other pressables look pressable too', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

  it('a collapsible section header is a bordered box with a chevron and a 44px target', () => {
    const toggle = body('.toggle', read('../SectionCard/SectionCard.module.css'))
    expect(value(toggle, 'border')).toMatch(/solid/)
    expect(px(value(toggle, 'min-height'))).toBeGreaterThanOrEqual(44)
    expect(value(toggle, 'cursor')).toBe('pointer')
    expect(read('../SectionCard/SectionCard.tsx')).toContain('styles.chevron')
  })

  it('header navigation links and the page back link are not plain text', () => {
    const shell = read('../AppShell/AppShell.module.css')
    expect(body('.nav a:hover', shell)).toMatch(/background/)
    expect(value(body('.nav a', shell), 'min-height')).toBeDefined()
    expect(
      value(body('.back a', read('../PageHeader/PageHeader.module.css')), 'text-decoration'),
    ).toMatch(/underline/)
  })
})

describe('icon buttons and small controls: boxed at rest, 44px targets', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  const cases: Array<[string, string, string]> = [
    ['NotificationBell', '../../../notifications/src/NotificationBell.module.css', '.bell'],
    ['ThemeToggle', '../../../theme/src/ThemeToggle.module.css', '.toggle'],
    ['CopyButton', '../CopyButton/CopyButton.module.css', '.button'],
    ['SectionIndex', '../SectionIndex/SectionIndex.module.css', '.link'],
    ['RowMenu trigger', '../RowMenu/RowMenu.module.css', '.button'],
    ['Dialog close', '../Dialog/Dialog.module.css', '.close'],
    ['Pagination', '../Pagination/Pagination.module.css', '.button'],
    ['Tabs', '../Tabs/Tabs.module.css', '.tab'],
  ]
  it.each(cases)('%s', (_name, file, selector) => {
    const rule = body(selector, read(file))
    const size = px(value(rule, 'min-height') ?? value(rule, 'height'))
    expect(size).toBeGreaterThanOrEqual(44)
    if (selector !== '.tab') {
      const border = value(rule, 'border')
      expect(border, 'has a visible border').toMatch(/solid/)
      expect(border).not.toMatch(/transparent/)
    }
  })
})
