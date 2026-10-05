import { expandVars, over, parseColor, contrast, themeVars } from '@skeleton/tokens'
import { build } from '@skeleton/tokens/build'
import { describe, expect, it } from 'vitest'
import { loadWorkspaces } from './support/loadWorkspaces'

/*
 * 앱이 실제로 쓰는 글자색 / 바탕색 짝 — 라이트 · 다크(와 시스템 다크) 모두 WCAG AA.
 * 본문 글자 4.5:1 · 큰 글자 · UI 경계(포커스 윤곽 등) 3:1. 새 화면이 새 짝을 쓰면 여기에 한 줄 더한다.
 * 장식용 선(--border · --border-strong)은 대비 대상이 아니다 — 입력칸 경계로 글자 대비처럼 지켜야 하는 곳이 생기면 짝을 더한다.
 */
type Pair = { fg: string; bg: string; min: number; use: string }

const BODY = 4.5
const UI = 3

const PAIRS: Pair[] = [
  // 본문
  ...['--bg', '--surface', '--surface-alt', '--surface-muted', '--surface-sunken'].map(
    (bg): Pair => ({ fg: '--text', bg, min: BODY, use: 'body text' }),
  ),
  ...['--bg', '--surface', '--surface-alt', '--surface-muted', '--surface-sunken', '--code-bg'].map(
    (bg): Pair => ({ fg: '--text-strong', bg, min: BODY, use: 'headings, code, pre' }),
  ),
  ...['--bg', '--surface', '--surface-alt', '--header-bg'].map(
    (bg): Pair => ({ fg: '--text-muted', bg, min: BODY, use: 'secondary text' }),
  ),
  { fg: '--text', bg: '--header-bg', min: BODY, use: 'header links' },
  // 상태 글자
  ...['--bg', '--surface', '--surface-alt', '--teal-soft', '--code-bg'].map(
    (bg): Pair => ({ fg: '--teal', bg, min: BODY, use: 'accent text / pills' }),
  ),
  ...['--bg', '--surface', '--amber-soft', '--code-bg'].map(
    (bg): Pair => ({ fg: '--amber', bg, min: BODY, use: 'warning text / pills' }),
  ),
  ...['--bg', '--surface', '--red-soft', '--code-bg'].map(
    (bg): Pair => ({ fg: '--red', bg, min: BODY, use: 'error text / pills' }),
  ),
  { fg: '--text-strong', bg: '--red-soft', min: BODY, use: 'error boundary message' },
  // 반전 버튼(.action-button, 브랜드 마크) · 호버 때 강조색 바탕
  { fg: '--on-inverse', bg: '--inverse', min: BODY, use: 'inverse button / brand mark' },
  { fg: '--on-inverse', bg: '--teal', min: BODY, use: 'inverse button hover' },
  { fg: '--on-inverse', bg: '--red', min: BODY, use: 'notification badge' },
  // UI 경계 · 포커스
  { fg: '--teal', bg: '--surface', min: UI, use: 'focus border' },
  { fg: '--teal', bg: '--bg', min: UI, use: 'focus border' },
  { fg: '--red', bg: '--red-soft', min: UI, use: 'error boundary border colour vs fill' },
]

const GENERATED = 'packages/tokens/tokens.css' // 색을 정의하는 곳이라 사용처 검사에서 뺀다
const css = build({ write: false }).css
const themes = [
  { label: 'light', vars: themeVars(css, 'light') },
  { label: 'dark', vars: themeVars(css, 'dark') },
  { label: 'dark (system)', vars: themeVars(css, 'dark', { system: true }) },
]

function colorOf(
  vars: Map<string, string>,
  name: string,
  backdrop?: ReturnType<typeof parseColor>,
) {
  const value = vars.get(name)
  if (value === undefined) throw new Error(`${name} is not defined`)
  const color = parseColor(expandVars(vars, value))
  return color.a < 1 && backdrop ? over(color, backdrop) : color
}

describe.each(themes)('WCAG AA pairs — $label', ({ vars }) => {
  it.each(PAIRS)('$fg on $bg ≥ $min ($use)', ({ fg, bg, min }) => {
    const page = colorOf(vars, '--bg')
    const ratio = contrast(colorOf(vars, fg, page), colorOf(vars, bg, page))
    expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(min)
  })
})

describe('the pair list covers what the CSS actually uses', () => {
  const screenCss = loadWorkspaces().flatMap((ws) =>
    ws.files
      .filter((f) => f.path.endsWith('.css') && `${ws.dir}/${f.path}` !== GENERATED)
      .map((f) => ({ file: `${ws.dir}/${f.path}`, text: f.text })),
  )

  it('scans some CSS (the check below is not looking at an empty list)', () => {
    expect(screenCss.length).toBeGreaterThan(0)
  })

  it('every semantic colour used as a `color:` anywhere in apps or packages appears in the pair list', () => {
    const listed = new Set(PAIRS.map((p) => p.fg))
    const unlisted = screenCss.flatMap(({ file, text }) =>
      [...text.matchAll(/(?<![-\w])color:\s*var\((--[\w-]+)\)/g)]
        .map((m) => m[1])
        .filter((name) => !listed.has(name))
        .map((name) => `${name} (${file})`),
    )
    expect(unlisted).toEqual([])
  })
})
