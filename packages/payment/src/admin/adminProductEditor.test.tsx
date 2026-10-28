import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { AdminProductEditor } from './AdminProductEditor'
import type { AdminCatalogProduct } from './catalogAdminTypes'

const languages = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
]
const noop = () => undefined
const product: AdminCatalogProduct = {
  code: 'standard',
  kind: 'SUBSCRIPTION',
  level: 2,
  highlighted: true,
  selling: true,
  sortOrder: 4,
  texts: {
    ko: { name: '스탠다드', description: '매일 쓰는 분께' },
    en: { name: 'Standard', description: null },
  },
  createdAt: 't',
  updatedAt: 't1',
  prices: [],
}
const failed = (code: string, status: number) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')
const create = (props: object = {}) =>
  renderToStaticMarkup(
    <AdminProductEditor
      mode="create"
      languages={languages}
      onSubmit={noop}
      labels={koPaymentLabels}
      {...props}
    />,
  )
const edit = (props: object = {}) =>
  renderToStaticMarkup(
    <AdminProductEditor
      mode="edit"
      product={product}
      languages={languages}
      onSubmit={noop}
      labels={koPaymentLabels}
      {...props}
    />,
  )

describe('AdminProductEditor', () => {
  it('create: asks for the code and kind, the level (subscription), and a name for each language; the submit is the filled button', () => {
    const html = create()
    expect(html).toContain('상품 코드')
    expect(html).toContain('종류')
    expect(html).toContain('등급')
    expect(html).toContain('이름 (한국어)')
    expect(html).toContain('이름 (English)')
    expect(html).toContain('설명 (한국어)')
    expect(html).toMatch(/data-variant="primary"[^>]*>상품 만들기/)
    expect(html).not.toContain('판매 중')
  })

  it('edit: the code and kind cannot be changed (no fields), the saved values are filled in and 「판매 중」 can be switched', () => {
    const html = edit()
    expect(html).not.toContain('상품 코드')
    expect(html).toContain('value="스탠다드"')
    expect(html).toContain('value="Standard"')
    expect(html).toContain('매일 쓰는 분께')
    expect(html).toContain('value="2"')
    expect(html).toContain('value="4"')
    expect(html).toContain('판매 중')
    expect(html).toMatch(/data-variant="primary"[^>]*>저장/)
  })

  it('a one-time product has no level field', () => {
    expect(edit({ product: { ...product, kind: 'ONE_TIME', level: null } })).not.toContain('등급')
  })

  it('a rejected save says why: a taken code, a taken level', () => {
    expect(create({ error: failed('CATALOG.CODE_TAKEN', 409) })).toContain('이미 쓰는 코드')
    expect(edit({ error: failed('CATALOG.LEVEL_TAKEN', 409) })).toContain('이미 쓰는 등급')
  })

  it('while saving the fields are locked and the button spins', () => {
    const html = edit({ busy: true })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('disabled=""')
  })

  it('a validation rejection shows the sentence and the server message under the wrong field', () => {
    const error = new ApiRequestError(
      {
        code: 'COMMON.VALIDATION_FAILED',
        title: 't',
        status: 400,
        timestamp: 't',
        errors: [
          { field: 'code', code: 'Pattern', message: 'bad code shape' },
          { field: 'texts.en.name', code: 'Size', message: 'name too long' },
        ],
      },
      'tr',
      'sp',
      'tp',
    )
    const html = create({ error })
    expect(html).toContain('입력을 확인해 주세요')
    expect(html).toContain('bad code shape')
    // 언어별 이름 칸 아래(영어 칸)에 붙는다
    expect(html).toContain('name too long')
  })
})
