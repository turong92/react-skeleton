/// <reference types="node" />
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { REPO } from './support/loadWorkspaces'

/*
 * eslint.config.js 의 「화면 코드는 @skeleton/ui 로 짠다」 규칙: 앱(apps/**)에서 날 <button> · <input> · <select> · <textarea> · <dialog>
 * 와 인라인 style 의 색 · 간격 날값을 막는다. 메시지는 대신 쓸 부품 이름을 말한다. @skeleton/ui 안쪽과 예외 앱(워크벤치)은 안 막는다.
 */
const eslint = new ESLint({ cwd: REPO })

async function messages(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${REPO}${filePath}` })
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message)
}

const APP = 'apps/starter/src/routes/X.tsx'
const page = (jsx: string) => `export function X() {\n  return ${jsx}\n}\n`

describe('raw interactive elements in app code', () => {
  it.each([
    ['<button>', '<button type="button">Save</button>', 'Button'],
    ['<input>', '<input />', 'Input'],
    ['<select>', '<select><option>a</option></select>', 'Select'],
    ['<textarea>', '<textarea />', 'Textarea'],
    ['<dialog>', '<dialog open>hi</dialog>', 'Dialog'],
  ])('forbids %s and names the @skeleton/ui component to use', async (_, jsx, component) => {
    const found = await messages(APP, page(jsx))
    expect(found).toHaveLength(1)
    expect(found[0]).toContain(`<${component}`)
    expect(found[0]).toContain('@skeleton/ui')
  })

  it('points a raw checkbox at Checkbox and Switch', async () => {
    const [message] = await messages(APP, page('<input type="checkbox" />'))
    expect(message).toMatch(/Checkbox/)
    expect(message).toMatch(/Switch/)
  })

  it('allows the @skeleton/ui components and ordinary elements', async () => {
    const jsx = `<form><label>x</label><Button>go</Button><Input /><a href="/">home</a></form>`
    expect(await messages(APP, page(jsx))).toEqual([])
  })

  it("applies to any app (a stamped project's own app too), not to @skeleton/ui itself", async () => {
    expect(await messages('apps/my-project/src/X.tsx', page('<button />'))).toHaveLength(1)
    expect(await messages('packages/ui/src/Button/X.tsx', page('<button />'))).toEqual([])
  })

  it('does not apply to packages other than apps (they own their own markup)', async () => {
    expect(await messages('packages/theme/src/X.tsx', page('<button />'))).toEqual([])
  })

  it('exempts the workbench app explicitly (its markup predates the components)', async () => {
    expect(await messages('apps/workbench/src/routes/X.tsx', page('<button />'))).toEqual([])
  })
})

describe('inline style literals in app code', () => {
  it.each([
    ['a colour', `<p style={{ color: 'red' }}>x</p>`],
    ['a background', `<p style={{ background: '#fff' }}>x</p>`],
    ['a padding', `<p style={{ padding: '4rem' }}>x</p>`],
    ['a margin number', `<p style={{ marginTop: 8 }}>x</p>`],
    ['a gap', `<p style={{ gap: '12px' }}>x</p>`],
    ['a radius', `<p style={{ borderRadius: 6 }}>x</p>`],
  ])('forbids %s literal and points at the semantic tokens', async (_, jsx) => {
    const found = await messages(APP, page(jsx))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatch(/var\(--/)
  })

  it('allows semantic tokens and non-visual styles (width from a prop, CSS custom properties)', async () => {
    const jsx = `<p style={{ color: 'var(--text-muted)', padding: 'var(--space-md)', width: \`\${w}%\` }}>x</p>`
    expect(await messages(APP, page(jsx))).toEqual([])
  })

  it('does not apply to @skeleton/ui, whose CSS modules are the source of the values', async () => {
    expect(
      await messages('packages/ui/src/Card/X.tsx', page(`<p style={{ color: 'red' }}>x</p>`)),
    ).toEqual([])
  })
})
