import { describe, expect, it } from 'vitest'
import type { AdminCatalogProduct } from './catalogAdminTypes'
import {
  emptyProductForm,
  productFormOf,
  validateProduct,
  type ProductForm,
  type ProductLanguage,
} from './productForm'

const languages: ProductLanguage[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
]
const filled = (over: Partial<ProductForm> = {}): ProductForm => ({
  ...emptyProductForm(languages),
  code: 'standard',
  level: '2',
  names: { ko: ' 스탠다드 ', en: 'Standard' },
  descriptions: { ko: '', en: ' For daily use ' },
  ...over,
})

describe('validateProduct (create)', () => {
  it('sends the code, kind, level, highlight, position and trimmed texts; an empty description is null', () => {
    expect(validateProduct(filled({ highlighted: true }), languages, 'create')).toEqual({
      problems: null,
      input: {
        code: 'standard',
        kind: 'SUBSCRIPTION',
        level: 2,
        highlighted: true,
        sortOrder: 0,
        texts: {
          ko: { name: '스탠다드', description: null },
          en: { name: 'Standard', description: 'For daily use' },
        },
      },
    })
  })

  it('a one-time product sends no level, whatever the field holds', () => {
    const result = validateProduct(filled({ kind: 'ONE_TIME', level: '3' }), languages, 'create')
    expect(result.input).not.toHaveProperty('level')
  })

  it('an empty level is left out', () => {
    expect(validateProduct(filled({ level: '' }), languages, 'create').input).not.toHaveProperty(
      'level',
    )
  })

  it('names what is wrong: code, level, position and every language without a name', () => {
    const result = validateProduct(
      filled({ code: 'Bad Code', level: '0', sortOrder: 'x', names: { ko: '', en: 'E' } }),
      languages,
      'create',
    )
    expect(result.problems).toEqual({
      code: 'codeInvalid',
      level: 'levelInvalid',
      sortOrder: 'sortOrderInvalid',
      names: ['ko'],
    })
    expect(validateProduct(filled({ code: ' ' }), languages, 'create').problems?.code).toBe(
      'codeEmpty',
    )
  })
})

describe('validateProduct (edit)', () => {
  const product: AdminCatalogProduct = {
    code: 'standard',
    kind: 'SUBSCRIPTION',
    level: 2,
    highlighted: false,
    selling: true,
    sortOrder: 3,
    texts: {
      ko: { name: '스탠다드', description: '설명' },
      en: { name: 'Standard', description: null },
    },
    createdAt: 't',
    updatedAt: 't',
    prices: [],
  }

  it('reads the product into the form and back; the code and kind are not sent (they cannot change)', () => {
    const form = productFormOf(product, languages)
    expect(form).toMatchObject({ code: 'standard', level: '2', sortOrder: '3', selling: true })
    const result = validateProduct({ ...form, selling: false }, languages, 'edit')
    expect(result.input).toEqual({
      level: 2,
      highlighted: false,
      selling: false,
      sortOrder: 3,
      texts: {
        ko: { name: '스탠다드', description: '설명' },
        en: { name: 'Standard', description: null },
      },
    })
    expect(result.input).not.toHaveProperty('code')
    expect(result.input).not.toHaveProperty('kind')
  })

  it('does not check the code (it is read-only here)', () => {
    expect(validateProduct(filled({ code: '' }), languages, 'edit').problems).toBeNull()
  })
})
