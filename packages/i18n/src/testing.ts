import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import type { CatalogSource, Messages } from './createI18n'

/**
 * 카탈로그 짝 맞춤 검사 — 앱이 자기 테스트에서 부른다(`@skeleton/i18n/testing`, 런타임 번들에는 안 들어간다).
 *
 * ```ts
 * it('catalogs agree', async () => {
 *   expect(await catalogProblems(catalogs, { defaultLocale: 'ko' })).toEqual([])
 * })
 * ```
 *
 * 문제 목록(문장)을 돌려주므로 실패하면 무엇이 어긋났는지 diff 로 바로 읽힌다. 검사:
 * 같은 키(빠짐 · 남음) · ICU 로 읽힘 · 인자가 기본 언어와 같음(번역이 모르는 인자를 쓰면 코드가 안 넘기는 값, 빼면 넘긴 값이 안 보임) ·
 * ICU 문법 옆 ASCII 아포스트로피(`'{` 는 인용이라 글이 사라진다) · 빈 문구.
 */
export type CatalogProblemsOptions = {
  /** 기준 언어 — 다른 언어는 이 언어의 키 · 인자와 맞춰 본다 */
  defaultLocale: string
  /** 번역이 인자를 빼는 것을 허용(한국어 조사처럼 한 언어만 쓰는 인자). 더하는 것은 여전히 문제다 */
  allowOmittedArgs?: boolean
}

/** 메시지가 쓰는 인자 · 태그 이름 — 복수형 · 선택의 가지 안쪽까지 */
export function messageArguments(message: string): Set<string> {
  const names = new Set<string>()
  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (element.type === TYPE.literal || element.type === TYPE.pound) continue
      if (element.type === TYPE.tag) {
        names.add(element.value)
        visit(element.children)
        continue
      }
      names.add(element.value)
      if (element.type === TYPE.plural || element.type === TYPE.select)
        for (const option of Object.values(element.options)) visit(option.value)
    }
  }
  visit(parse(message))
  return names
}

async function resolve(source: CatalogSource): Promise<Messages> {
  if (typeof source !== 'function') return source
  const loaded = await source()
  return 'default' in loaded && typeof loaded.default === 'object'
    ? loaded.default
    : (loaded as Messages)
}

const APOSTROPHE_NEXT_TO_SYNTAX = /'[{}<#]|[{}>]'/

export async function catalogProblems(
  catalogs: Record<string, CatalogSource>,
  options: CatalogProblemsOptions,
): Promise<string[]> {
  const { defaultLocale, allowOmittedArgs = false } = options
  if (!(defaultLocale in catalogs))
    throw new Error(`catalogProblems: default locale "${defaultLocale}" is not among the catalogs`)
  const resolved: Record<string, Messages> = {}
  for (const [locale, source] of Object.entries(catalogs)) resolved[locale] = await resolve(source)
  const base = resolved[defaultLocale]
  const problems: string[] = []

  for (const [locale, messages] of Object.entries(resolved)) {
    if (locale !== defaultLocale) {
      for (const key of Object.keys(base))
        if (!(key in messages))
          problems.push(`${locale}: missing key "${key}" (present in ${defaultLocale})`)
      for (const key of Object.keys(messages))
        if (!(key in base)) problems.push(`${locale}: extra key "${key}" (not in ${defaultLocale})`)
    }
    for (const [key, message] of Object.entries(messages)) {
      const where = `${locale} "${key}"`
      if (typeof message !== 'string') {
        problems.push(`${where}: not a string`)
        continue
      }
      if (message.trim() === '') {
        problems.push(`${where}: empty message`)
        continue
      }
      if (APOSTROPHE_NEXT_TO_SYNTAX.test(message))
        problems.push(
          `${where}: ASCII apostrophe next to ICU syntax quotes the text and drops it — use ’ (or '' for a literal ')`,
        )
      let args: Set<string>
      try {
        args = messageArguments(message)
      } catch (error) {
        problems.push(
          `${where}: not valid ICU (${error instanceof Error ? error.message : String(error)})`,
        )
        continue
      }
      const source = locale === defaultLocale ? undefined : base[key]
      if (typeof source !== 'string') continue
      let expected: Set<string>
      try {
        expected = messageArguments(source)
      } catch {
        continue // 기준 언어의 오류는 기준 언어 쪽에서 이미 보고했다
      }
      for (const name of args)
        if (!expected.has(name))
          problems.push(`${where}: uses {${name}}, which ${defaultLocale} does not`)
      if (!allowOmittedArgs)
        for (const name of expected)
          if (!args.has(name))
            problems.push(`${where}: does not use {${name}}, which ${defaultLocale} does`)
    }
  }
  return problems
}
