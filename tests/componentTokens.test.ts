import { describe, expect, it } from 'vitest'
import { loadWorkspaces } from './support/loadWorkspaces'

/*
 * 부품 토큰(tokens.json 의 component 절 → --<부품>-<이름>)이 실제로 부품 CSS 의 손잡이인지.
 * 정의만 있고 아무 부품도 안 쓰는 토큰은 값을 바꿔도 화면이 안 바뀌어 프로젝트를 속인다.
 */
const workspaces = loadWorkspaces()
const tokensCss =
  workspaces.find((w) => w.dir === 'packages/tokens')?.files.find((f) => f.path === 'tokens.css')
    ?.text ?? ''
const componentBlock = tokensCss.slice(Math.max(0, tokensCss.indexOf('/* component')))
const declared = [...componentBlock.matchAll(/^ {2}(--[a-z0-9-]+):/gm)].map((m) => m[1])
const ui = workspaces.find((w) => w.dir === 'packages/ui')
const uiModules = (ui?.files ?? []).filter((f) => f.path.endsWith('.module.css'))
const uiCss = uiModules.map((f) => f.text).join('\n')
/** 규칙마다 선언 글자 — `}` 로 나눈 조각(중첩 없는 CSS Modules 라 충분하다) */
const rulesPainting = (value: string) =>
  uiModules.flatMap((f) =>
    f.text
      .split('}')
      .filter((rule) => rule.includes(value))
      .map((rule) => ({ where: `${f.path}: ${rule.trim().split('{')[0]}`, rule })),
  )

describe.skipIf(!ui)('component tokens', () => {
  it('there are component tokens to check', () => {
    expect(declared.length).toBeGreaterThan(0)
  })

  it.each(declared)('%s is used by @skeleton/ui CSS', (name) => {
    expect(uiCss).toContain(`var(${name})`)
  })

  it('surfaces that can blur read their backdrop handle', () => {
    for (const part of ['button', 'card', 'overlay', 'shell'])
      expect(uiCss, part).toContain(`backdrop-filter: var(--${part}-backdrop)`)
  })

  it('every rule that paints the primary button background also sets its text colour handle', () => {
    for (const { where, rule } of rulesPainting('background: var(--button-primary-bg)'))
      expect(rule, where).toContain('color: var(--button-primary-fg)')
  })

  it('every part that paints the secondary button background can blur it', () => {
    for (const { where, rule } of rulesPainting('background: var(--button-secondary-bg)'))
      expect(rule, where).toContain('backdrop-filter: var(--button-backdrop)')
  })
})
