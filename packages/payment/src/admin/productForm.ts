import type { CatalogKind, CatalogProductText } from '../catalogTypes'
import type {
  AdminCatalogProduct,
  CreateCatalogProductInput,
  UpdateCatalogProductInput,
} from './catalogAdminTypes'

export type ProductLanguage = { code: string; label: string }

/** 상품 폼이 쥔 글자들 */
export type ProductForm = {
  code: string
  kind: CatalogKind
  level: string
  highlighted: boolean
  selling: boolean
  sortOrder: string
  /** 언어 코드 → 글 */
  names: Record<string, string>
  descriptions: Record<string, string>
}

export type ProductProblems = {
  code?: 'codeEmpty' | 'codeInvalid'
  level?: 'levelInvalid'
  sortOrder?: 'sortOrderInvalid'
  /** 이름이 빈 언어 코드들 */
  names?: string[]
}

export function emptyProductForm(languages: readonly ProductLanguage[]): ProductForm {
  return {
    code: '',
    kind: 'SUBSCRIPTION',
    level: '',
    highlighted: false,
    selling: true,
    sortOrder: '0',
    names: Object.fromEntries(languages.map((l) => [l.code, ''])),
    descriptions: Object.fromEntries(languages.map((l) => [l.code, ''])),
  }
}

export function productFormOf(
  product: AdminCatalogProduct,
  languages: readonly ProductLanguage[],
): ProductForm {
  return {
    code: product.code,
    kind: product.kind,
    level: product.level === null ? '' : String(product.level),
    highlighted: product.highlighted,
    selling: product.selling,
    sortOrder: String(product.sortOrder),
    names: Object.fromEntries(languages.map((l) => [l.code, product.texts[l.code]?.name ?? ''])),
    descriptions: Object.fromEntries(
      languages.map((l) => [l.code, product.texts[l.code]?.description ?? '']),
    ),
  }
}

const CODE = /^[a-z0-9][a-z0-9-]*$/

function textsOf(
  form: ProductForm,
  languages: readonly ProductLanguage[],
): Record<string, CatalogProductText> {
  return Object.fromEntries(
    languages.map((l) => {
      const description = (form.descriptions[l.code] ?? '').trim()
      return [l.code, { name: (form.names[l.code] ?? '').trim(), description: description || null }]
    }),
  )
}

/**
 * 폼 → 서버로 보낼 값. 이름은 보이는 언어마다 필수(설명은 선택), 등급은 비우면 보내지 않는다(구독 상품만).
 * 틀린 칸이 있으면 `input` 없이 칸별 이유만 돌려준다 - 코드 · 등급 중복은 서버(`CATALOG.CODE_TAKEN` · `CATALOG.LEVEL_TAKEN`)가 판단한다.
 */
export function validateProduct(
  form: ProductForm,
  languages: readonly ProductLanguage[],
  mode: 'create' | 'edit',
):
  | { problems: null; input: CreateCatalogProductInput | UpdateCatalogProductInput }
  | { problems: ProductProblems; input: null } {
  const problems: ProductProblems = {}
  const code = form.code.trim()
  if (mode === 'create') {
    if (code === '') problems.code = 'codeEmpty'
    else if (!CODE.test(code)) problems.code = 'codeInvalid'
  }
  const subscription = form.kind === 'SUBSCRIPTION'
  const level = form.level.trim()
  if (subscription && level !== '' && !/^[1-9]\d{0,8}$/.test(level)) problems.level = 'levelInvalid'
  const sort = form.sortOrder.trim()
  if (sort !== '' && !/^-?\d{1,9}$/.test(sort)) problems.sortOrder = 'sortOrderInvalid'
  const missing = languages
    .filter((l) => (form.names[l.code] ?? '').trim() === '')
    .map((l) => l.code)
  if (missing.length > 0) problems.names = missing
  if (Object.keys(problems).length > 0) return { input: null, problems }

  const common = {
    ...(subscription && level !== '' ? { level: Number(level) } : {}),
    highlighted: form.highlighted,
    ...(sort !== '' ? { sortOrder: Number(sort) } : {}),
    texts: textsOf(form, languages),
  }
  return {
    problems: null,
    input:
      mode === 'create'
        ? { code, kind: form.kind, ...common }
        : { ...common, selling: form.selling },
  }
}
