import { describe, expect, it } from 'vitest'
import { applyDocumentMeta, type MetaDocument } from './applyDocumentMeta'

type FakeElement = {
  setAttribute(name: string, value: string): void
  getAttribute(name: string): string | null
  remove(): void
}

/** `document` 의 필요한 만큼만 흉내 낸 작은 문서 — head 에 meta 태그를 둔다 */
function fakeDocument(initial: Record<string, string> = {}) {
  const metas = new Map(Object.entries(initial))
  const fake = {
    title: 'old',
    head: {
      appendChild(element: FakeElement) {
        metas.set(element.getAttribute('name')!, element.getAttribute('content')!)
      },
    },
    createElement: () => {
      const attributes = new Map<string, string>()
      return {
        setAttribute: (name: string, value: string) => void attributes.set(name, value),
        getAttribute: (name: string) => attributes.get(name) ?? null,
        remove: () => undefined,
      }
    },
    querySelector(selector: string) {
      const name = /meta\[name="([^"]+)"\]/.exec(selector)![1]
      if (!metas.has(name)) return null
      return {
        setAttribute: (attribute: string, value: string) => {
          if (attribute === 'content') metas.set(name, value)
        },
        getAttribute: (attribute: string) => (attribute === 'content' ? metas.get(name)! : name),
        remove: () => void metas.delete(name),
      }
    },
  }
  return { doc: fake as unknown as MetaDocument & { title: string }, metas }
}

describe('applyDocumentMeta — keeps the title and meta tags right after a client-side navigation', () => {
  it('sets the title and updates an existing description', () => {
    const { doc, metas } = fakeDocument({ description: 'old description' })
    applyDocumentMeta(doc, { title: '계정 · app', description: 'new description' })
    expect(doc.title).toBe('계정 · app')
    expect(metas.get('description')).toBe('new description')
  })

  it('adds the description and the robots meta when the server page had none, removes robots when the next page does not ask', () => {
    const { doc, metas } = fakeDocument()
    applyDocumentMeta(doc, { title: 't', description: 'd', robots: 'noindex' })
    expect(metas.get('description')).toBe('d')
    expect(metas.get('robots')).toBe('noindex')
    applyDocumentMeta(doc, { title: 't2', description: 'd2' })
    expect(metas.has('robots')).toBe(false)
    expect(metas.get('description')).toBe('d2')
  })
})
