import { Button, Checkbox, Field, Input, Select, Textarea } from '@skeleton/ui'
import { useState } from 'react'
import type { CatalogKind } from '../catalogTypes'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import type {
  AdminCatalogProduct,
  CreateCatalogProductInput,
  UpdateCatalogProductInput,
} from './catalogAdminTypes'
import { CatalogErrorNotice } from './CatalogErrorNotice'
import {
  emptyProductForm,
  productFormOf,
  validateProduct,
  type ProductForm,
  type ProductLanguage,
  type ProductProblems,
} from './productForm'
import styles from './AdminProductEditor.module.css'

type Common = {
  /** 이름 · 설명을 적을 언어들 - 앱이 정한다(예: 한국어 · English) */
  languages: readonly ProductLanguage[]
  busy?: boolean
  /** 저장이 실패했을 때의 오류 - 알려진 거절(코드 · 등급 중복)은 이유를, 그 밖은 일반 문구와 참조 번호를 */
  error?: unknown
  labels?: PaymentLabelsInput
}

type Create = {
  mode: 'create'
  onSubmit: (input: CreateCatalogProductInput) => void
}

type Edit = {
  mode: 'edit'
  product: AdminCatalogProduct
  onSubmit: (input: UpdateCatalogProductInput) => void
}

export type AdminProductEditorProps = Common & (Create | Edit)

const KINDS: readonly CatalogKind[] = ['SUBSCRIPTION', 'ONE_TIME']

/**
 * 상품 폼 - 만들 때는 코드 · 종류(만든 뒤에는 못 바꾼다)까지, 고칠 때는 등급 · 인기 · 판매 중 · 정렬 · 언어별 이름과 설명.
 * 등급은 구독 상품만. 이름은 보이는 언어마다 필수. 틀린 칸은 「저장」을 누를 때 칸 아래에서 이유를 말한다.
 * 고치는 모습은 저장된 상품(`product.updatedAt`)이 바뀌면 그 값으로 다시 채운다.
 */
export function AdminProductEditor(props: AdminProductEditorProps) {
  const { languages, busy, error, labels: input } = props
  const all = resolvePaymentLabels(input)
  const text = all.admin.catalog.editor
  const edit = props.mode === 'edit'
  const initial = (): ProductForm =>
    props.mode === 'edit' ? productFormOf(props.product, languages) : emptyProductForm(languages)
  const [form, setForm] = useState<ProductForm>(initial)
  const [problems, setProblems] = useState<ProductProblems>({})
  const stamp = props.mode === 'edit' ? props.product.updatedAt : ''
  const [seen, setSeen] = useState(stamp)
  if (stamp !== seen) {
    setSeen(stamp)
    setForm(initial())
    setProblems({})
  }
  const set = (patch: Partial<ProductForm>) => setForm((current) => ({ ...current, ...patch }))
  const labelOf = (code: string) => languages.find((l) => l.code === code)?.label ?? code
  const say = (key: 'code' | 'level' | 'sortOrder') => {
    const problem = problems[key]
    return problem ? text.problems[problem] : undefined
  }
  const subscription = form.kind === 'SUBSCRIPTION'

  return (
    <form
      className={styles.form}
      noValidate
      aria-label={edit ? text.save : text.create}
      onSubmit={(event) => {
        event.preventDefault()
        if (busy) return
        const result = validateProduct(form, languages, props.mode)
        setProblems(result.problems ?? {})
        if (result.input) (props.onSubmit as (value: typeof result.input) => void)(result.input)
      }}
    >
      {!edit && (
        <>
          <Field label={text.code} hint={text.codeHint} error={say('code')} required>
            {(control) => (
              <Input
                {...control}
                value={form.code}
                disabled={busy}
                onChange={(event) => set({ code: event.target.value })}
              />
            )}
          </Field>
          <Field label={text.kind}>
            {(control) => (
              <Select
                {...control}
                value={form.kind}
                disabled={busy}
                onChange={(event) => set({ kind: event.target.value as CatalogKind })}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {all.admin.catalog.kinds[kind]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}
      {subscription && (
        <Field label={text.level} hint={text.levelHint} error={say('level')}>
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={form.level}
              disabled={busy}
              onChange={(event) => set({ level: event.target.value })}
            />
          )}
        </Field>
      )}
      <Field label={text.sortOrder} hint={text.sortOrderHint} error={say('sortOrder')}>
        {(control) => (
          <Input
            {...control}
            inputMode="numeric"
            value={form.sortOrder}
            disabled={busy}
            onChange={(event) => set({ sortOrder: event.target.value })}
          />
        )}
      </Field>
      <Checkbox
        label={text.highlighted}
        checked={form.highlighted}
        disabled={busy}
        onChange={(event) => set({ highlighted: event.target.checked })}
      />
      {edit && (
        <Checkbox
          label={text.selling}
          checked={form.selling}
          disabled={busy}
          onChange={(event) => set({ selling: event.target.checked })}
        />
      )}
      <fieldset className={styles.texts}>
        <legend>{text.texts}</legend>
        {languages.map((language) => (
          <div key={language.code} className={styles.language}>
            <Field
              label={text.name(language.label)}
              error={
                problems.names?.includes(language.code)
                  ? text.problems.nameEmpty(labelOf(language.code))
                  : undefined
              }
              required
            >
              {(control) => (
                <Input
                  {...control}
                  value={form.names[language.code] ?? ''}
                  disabled={busy}
                  onChange={(event) =>
                    set({ names: { ...form.names, [language.code]: event.target.value } })
                  }
                />
              )}
            </Field>
            <Field label={text.description(language.label)}>
              {(control) => (
                <Textarea
                  {...control}
                  rows={2}
                  value={form.descriptions[language.code] ?? ''}
                  disabled={busy}
                  onChange={(event) =>
                    set({
                      descriptions: { ...form.descriptions, [language.code]: event.target.value },
                    })
                  }
                />
              )}
            </Field>
          </div>
        ))}
      </fieldset>
      <CatalogErrorNotice error={error} labels={input} />
      <div>
        <Button type="submit" variant="primary" loading={busy} loadingLabel={text.saving}>
          {edit ? text.save : text.create}
        </Button>
      </div>
    </form>
  )
}
