/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO } from './support/loadWorkspaces'

/*
 * 눌리는 것은 한눈에 눌리는 것으로 보인다 — 쉬는 상태에서도 테두리나 채움이 있고(글자만 있는 버튼 금지) 목표는 44px 이상이며,
 * hover · focus 가 다르게 보인다(원칙: docs/ui-catalog.md 맨 위). 스타일 파일을 읽어 단정한다.
 * 정말 인라인 링크여야 하는 것은 밑줄 + 링크색. 눌리는 요소를 더하면 아래 표에 한 줄 더한다.
 * 이 레포에서 찍은 프로젝트는 패키지를 골라 가므로, 패키지 폴더가 없는 줄은 건너뛴다(폴더가 있는데 파일이 없으면 실패 — 이름을 바꾸면 알려야 한다).
 * 참조 앱의 링크 부품(TextLink · LinkCard · LinkButton)은 apps 쪽 affordance.test.ts 가 맡는다.
 */
const css = (path: string) => readFileSync(join(REPO, path), 'utf8')
const has = (dir: string) => existsSync(join(REPO, dir))

/** `selector { … }` 의 본문(여러 규칙이면 이어 붙인다). 미디어 쿼리 안은 `within` 으로 */
function body(selector: string, within: string): string {
  const escaped = selector.replace(/[.[\]()':>*+~^$|\\]/g, '\\$&')
  const rules = [...within.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
  return rules.map((m) => m[1]).join('\n')
}
const value = (text: string, property: string) =>
  text.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1].trim()
const px = (text: string | undefined) => Number(text?.replace('px', ''))
const visible = (v: string | undefined) => v !== undefined && v !== 'transparent'

type Row = {
  name: string
  /** 이 패키지 폴더가 없으면(찍힌 프로젝트가 안 가져갔다) 건너뛴다 */
  dir: string
  file: string
  /** 쉬는 상태의 규칙 */
  base: string
}

const ROWS: Row[] = [
  {
    name: 'NotificationBell',
    dir: 'packages/notifications',
    file: 'packages/notifications/src/NotificationBell.module.css',
    base: '.bell',
  },
  {
    name: 'rewards admin row link',
    dir: 'packages/rewards',
    file: 'packages/rewards/src/admin/shared.module.css',
    base: '.actionLink',
  },
  {
    name: 'ThemeToggle',
    dir: 'packages/theme',
    file: 'packages/theme/src/ThemeToggle.module.css',
    base: '.toggle',
  },
]

describe.each(ROWS.filter((r) => has(r.dir)))('$name affordance', (row) => {
  const rest = body(row.base, css(row.file))

  it('is a bordered box (a visible solid border), at least 44px tall, with a pointer', () => {
    expect(value(rest, 'border')).toMatch(/solid/)
    expect(value(rest, 'border')).not.toMatch(/transparent/)
    expect(px(value(rest, 'min-height') ?? value(rest, 'height'))).toBeGreaterThanOrEqual(44)
    expect(value(rest, 'cursor')).toBe('pointer')
  })
})

describe.skipIf(!has('packages/ui'))('Button affordance', () => {
  const button = css('packages/ui/src/Button/Button.module.css')
  const FILLED_OR_OUTLINED = ['primary', 'secondary', 'ghost', 'danger'] as const

  it.each(FILLED_OR_OUTLINED)('%s has a visible border or fill while resting', (variant) => {
    const rule = body(`.button[data-variant='${variant}']`, button)
    const border = value(rule, 'border-color')
    const background = value(rule, 'background')
    expect(
      visible(border) || visible(background),
      `${variant}: border=${border} background=${background}`,
    ).toBe(true)
  })

  it('the link variant is for inline links: underlined, in the link colour, and not boxed', () => {
    const rule = body(`.button[data-variant='link']`, button)
    expect(value(rule, 'text-decoration')).toMatch(/underline/)
    expect(value(rule, 'color')).toBe('var(--teal)')
  })

  it('touch targets: md is at least 44px tall, sm at least 36px (44px on coarse pointers)', () => {
    expect(px(value(body('.button', button), 'min-height'))).toBeGreaterThanOrEqual(44)
    expect(px(value(body(`.button[data-size='sm']`, button), 'min-height'))).toBeGreaterThanOrEqual(
      36,
    )
    const coarse = button.slice(button.indexOf('@media (pointer: coarse)'))
    expect(px(value(body(`.button[data-size='sm']`, coarse), 'min-height'))).toBeGreaterThanOrEqual(
      44,
    )
  })

  it('every state is distinguishable: hover, active, focus-visible, and a dimmed disabled', () => {
    expect(
      body(
        `.button[data-variant='ghost']:hover:not(:disabled):not([aria-disabled='true'])`,
        button,
      ),
    ).not.toBe('')
    expect(body(".button:active:not(:disabled):not([aria-disabled='true'])", button)).not.toBe('')
    expect(body('.button:focus-visible', button)).toMatch(/outline/)
    expect(value(body('.button:disabled', button), 'opacity')).toBeDefined()
    expect(value(body('.button', button), 'cursor')).toBe('pointer')
    expect(value(body('.button:disabled', button), 'cursor')).toBe('not-allowed')
  })

  it('aria-disabled looks disabled like :disabled, and hover / active effects skip it', () => {
    expect(value(body(".button[aria-disabled='true']", button), 'cursor')).toBe('not-allowed')
    expect(value(body(".button[aria-disabled='true']", button), 'opacity')).toBeDefined()
    for (const line of button.split('\n').filter((l) => /:(hover|active)/.test(l)))
      expect(line, line).toContain(":not([aria-disabled='true'])")
  })

  it('a collapsible section header is a bordered box with a chevron and a 44px target', () => {
    const toggle = body('.toggle', css('packages/ui/src/SectionCard/SectionCard.module.css'))
    expect(value(toggle, 'border')).toMatch(/solid/)
    expect(px(value(toggle, 'min-height'))).toBeGreaterThanOrEqual(44)
    expect(value(toggle, 'cursor')).toBe('pointer')
    expect(css('packages/ui/src/SectionCard/SectionCard.tsx')).toContain('styles.chevron')
  })

  it('header navigation links and the page back link are not plain text', () => {
    const shell = css('packages/ui/src/AppShell/AppShell.module.css')
    expect(body('.nav a:hover', shell)).toMatch(/background/)
    expect(body('.nav a:active', shell)).toMatch(/background/)
    const current = body(".nav a[aria-current='page']", shell) // 지금 위치는 색만이 아니다
    expect(value(current, 'font-weight')).toBe('750')
    expect(current).toMatch(/box-shadow/)
    expect(value(body('.nav a', shell), 'min-height')).toBeDefined()
    expect(
      value(
        body('.back a', css('packages/ui/src/PageHeader/PageHeader.module.css')),
        'text-decoration',
      ),
    ).toMatch(/underline/)
  })

  // 아이콘 단추 · 작은 조작: 쉬는 상태에서 테두리 + 44px
  const small: Array<[string, string, string]> = [
    ['CopyButton', 'CopyButton', '.button'],
    ['SectionIndex', 'SectionIndex', '.link'],
    ['RowMenu trigger', 'RowMenu', '.button'],
    ['Dialog close', 'Dialog', '.close'],
    ['Pagination', 'Pagination', '.button'],
    ['Tabs', 'Tabs', '.tab'],
  ]
  it.each(small)('%s is a 44px target (boxed at rest, except tabs)', (_name, dir, selector) => {
    const rule = body(selector, css(`packages/ui/src/${dir}/${dir}.module.css`))
    expect(px(value(rule, 'min-height') ?? value(rule, 'height'))).toBeGreaterThanOrEqual(44)
    if (selector !== '.tab') {
      const border = value(rule, 'border')
      expect(border, 'has a visible border').toMatch(/solid/)
      expect(border).not.toMatch(/transparent/)
    }
  })
})

describe.skipIf(!has('packages/ui'))('ChoiceGroup affordance', () => {
  // 선택 묶음도 눌리는 것이다 — 고른 것은 색만이 아니라 테두리 · 바탕 · 안쪽 선으로 분명하고, 안 고른 칸의 hover 는 고른 칸과 다르며, 잠긴 것은 흐려진다
  const choice = css('packages/ui/src/ChoiceGroup/ChoiceGroup.module.css')
  const rule = (selector: RegExp) => choice.match(selector)?.[1] ?? ''

  it('is at least 44px tall at rest', () => {
    const base = rule(/\.choice\s*\{([^}]*)\}/)
    expect(Number(base.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44)
  })

  it('the chosen one changes border, fill and weight — beyond colour alone', () => {
    const chosen = rule(/\.choice\[aria-checked='true'\]\s*\{([^}]*)\}/)
    expect(chosen).toMatch(/border-color:\s*var\(--teal\)/)
    expect(chosen).toMatch(/background:\s*var\(--teal-wash\)/)
    expect(chosen).toMatch(/box-shadow:\s*inset/)
  })

  it('hovering one that is not chosen never makes it look chosen (no teal border, no teal fill, no inner line)', () => {
    const hover = rule(
      /\.choice[^{]*:hover[^{]*:not\(\[aria-checked='true'\]\)[^{]*\{([^}]*)\}|\.choice[^{]*:not\(\[aria-checked='true'\]\)[^{]*:hover[^{]*\{([^}]*)\}/,
    )
    expect(hover, 'a hover rule for the choices that are not chosen').not.toBe('')
    expect(hover).not.toMatch(/--teal/)
    expect(hover).not.toMatch(/box-shadow/)
    expect(hover).toMatch(/border-color:/)
  })

  it('a locked group looks locked', () => {
    expect(choice).toMatch(/\[aria-disabled='true'\]/)
  })
})
