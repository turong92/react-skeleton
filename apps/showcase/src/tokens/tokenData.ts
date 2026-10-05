import tokensJson from '@skeleton/tokens/tokens.json'

/*
 * tokens.json 을 브라우저에서 읽는다 — 생성기(@skeleton/tokens/build)는 node:fs 를 써서 브라우저 번들에 못 들어간다.
 * 이름 규칙과 참조 풀기는 생성기와 같고, 같은 결과인지는 tokenData.test.tsx 가 생성기와 대조한다.
 */
export const THEME_NAMES = ['light', 'dark'] as const
export type ThemeName = (typeof THEME_NAMES)[number]

export type SemanticToken = {
  cssName: string
  group: string
  description: string
  /** 테마마다 끝까지 푼 값 */
  values: Record<ThemeName, string>
}

type Node = Record<string, unknown>
type Leaf = { $value: string; $description?: string; $extensions?: { skeleton?: Node } }
const REF = /\{([^{}]+)\}/g
const isLeaf = (node: unknown): node is Leaf =>
  typeof node === 'object' && node !== null && '$value' in node

export function readSemanticTokens(json: Node = tokensJson as Node): SemanticToken[] {
  const leaves = new Map<string, Leaf>()
  const walk = (node: Node, path: string[]) => {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$') || typeof child !== 'object' || child === null) continue
      if (isLeaf(child)) leaves.set([...path, key].join('.'), child)
      else walk(child as Node, [...path, key])
    }
  }
  walk(json, [])

  const resolve = (path: string, theme: ThemeName, stack: string[] = []): string => {
    if (stack.includes(path)) throw new Error(`reference cycle: ${[...stack, path].join(' → ')}`)
    const leaf = leaves.get(path)
    if (!leaf) throw new Error(`missing reference {${path}}`)
    const own = leaf.$extensions?.skeleton?.[theme]
    const raw = typeof own === 'string' ? own : leaf.$value
    return String(raw).replace(REF, (_, ref: string) => resolve(ref, theme, [...stack, path]))
  }

  return [...leaves.keys()]
    .filter((path) => path.startsWith('semantic.'))
    .map((path) => ({
      cssName: `--${path.split('.').at(-1)}`,
      group: path.split('.')[1],
      description: leaves.get(path)!.$description ?? '',
      values: { light: resolve(path, 'light'), dark: resolve(path, 'dark') },
    }))
}
