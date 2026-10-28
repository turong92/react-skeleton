import { Button, Checkbox, Field, Input, Select } from '@skeleton/ui'
import { useId, useState } from 'react'
import type { CouponStage, CouponStageType } from '../types'
import { mergeAdminLabels } from './adminErrors'
import type { RewardsAdminLabels } from './labels'
import {
  addStage,
  freeMonths,
  freeVoucher,
  MAX_STAGES,
  removeStage,
  setForever,
  updateStage,
} from './stageEdits'
import styles from './StageEditor.module.css'

export type StageEditorProps = {
  stages: readonly CouponStage[]
  onChange: (stages: CouponStage[]) => void
  labels?: Partial<RewardsAdminLabels>
}

const TYPES: readonly CouponStageType[] = ['FREE', 'PERCENT', 'FIXED']

/**
 * 쿠폰 혜택 단계 편집기 - 단계(무료 · 정률 · 정액) × 횟수(또는 영원). 단계는 다섯까지, 「영원」은 마지막 단계만.
 * 「무료 이용권」 · 「n달 무료」 틀 단추가 단계를 통째로 채운다. 값은 정수(정률은 퍼센트, 정액은 통화의 최소 단위).
 */
export function StageEditor({ stages, onChange, labels: given }: StageEditorProps) {
  const all = mergeAdminLabels(given)
  const t = all.stageEditor
  const [months, setMonths] = useState('3')
  const limitId = useId()
  const full = stages.length >= MAX_STAGES
  const numberOf = (text: string) => (text === '' ? 0 : Math.max(0, Math.trunc(Number(text))) || 0)
  return (
    <fieldset className={styles.editor}>
      <legend>{t.legend}</legend>
      <div className={styles.templates}>
        <span className={styles.muted}>{t.templates}</span>
        <Button variant="secondary" size="sm" onClick={() => onChange(freeVoucher())}>
          {t.voucher}
        </Button>
        <Field label={t.monthsLabel}>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={1}
              max={36}
              value={months}
              className={styles.months}
              onChange={(event) => setMonths(event.target.value)}
            />
          )}
        </Field>
        <Button variant="secondary" size="sm" onClick={() => onChange(freeMonths(Number(months)))}>
          {t.freeMonths(freeMonths(Number(months))[0]?.periods ?? 1)}
        </Button>
      </div>
      {stages.length === 0 && <p className={styles.muted}>{t.empty}</p>}
      <ol className={styles.stages}>
        {stages.map((stage, index) => {
          const last = index === stages.length - 1
          return (
            <li key={index} className={styles.stage}>
              <strong>{t.stage(index + 1)}</strong>
              <Field label={`${t.stage(index + 1)} ${t.type}`}>
                {(control) => (
                  <Select
                    {...control}
                    value={stage.type}
                    onChange={(event) =>
                      onChange(
                        updateStage(stages, index, { type: event.target.value as CouponStageType }),
                      )
                    }
                  >
                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t.types[type]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {stage.type !== 'FREE' && (
                <Field label={`${t.stage(index + 1)} ${t.value}`}>
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={0}
                      max={stage.type === 'PERCENT' ? 100 : undefined}
                      value={stage.value}
                      onChange={(event) =>
                        onChange(
                          updateStage(stages, index, { value: numberOf(event.target.value) }),
                        )
                      }
                    />
                  )}
                </Field>
              )}
              {stage.type === 'PERCENT' && (
                <Field label={`${t.stage(index + 1)} ${t.maxDiscount}`}>
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={0}
                      value={stage.maxDiscount ?? ''}
                      onChange={(event) =>
                        onChange(
                          updateStage(stages, index, {
                            maxDiscount:
                              event.target.value === '' ? null : numberOf(event.target.value),
                          }),
                        )
                      }
                    />
                  )}
                </Field>
              )}
              <Field label={`${t.stage(index + 1)} ${t.periods}`}>
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min={1}
                    disabled={stage.periods === null}
                    value={stage.periods ?? ''}
                    onChange={(event) =>
                      onChange(
                        updateStage(stages, index, {
                          periods: Math.max(1, numberOf(event.target.value)),
                        }),
                      )
                    }
                  />
                )}
              </Field>
              <Checkbox
                label={`${t.stage(index + 1)} ${t.forever}`}
                description={last ? undefined : t.foreverOnlyLast}
                disabled={!last}
                checked={stage.periods === null}
                onChange={(event) => onChange(setForever(stages, index, event.target.checked))}
              />
              <Button
                variant="danger"
                size="sm"
                aria-label={t.remove(index + 1)}
                onClick={() => onChange(removeStage(stages, index))}
              >
                {all.remove}
              </Button>
            </li>
          )
        })}
      </ol>
      <div className={styles.add}>
        <Button
          variant="secondary"
          disabled={full}
          aria-describedby={full ? limitId : undefined}
          onClick={() => onChange(addStage(stages))}
        >
          {t.add}
        </Button>
        {full && (
          <span id={limitId} className={styles.muted}>
            {t.addLimit(MAX_STAGES)}
          </span>
        )}
      </div>
    </fieldset>
  )
}
