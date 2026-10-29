import { Button, Field, Input, Select } from '@skeleton/ui'
import { mergeAdminLabels } from './adminErrors'
import type { RewardsAdminLabels } from './labels'
import type { RewardConfig } from './types'
import styles from './RewardListEditor.module.css'

export type CouponChoice = { id: string; name: string }
/** 배지 보상에서 고를 배지 - `code` 가 지급기에 가는 값이다 */
export type BadgeChoice = { code: string; name: string }

export type RewardListEditorProps = {
  /** 이 목록의 이름(필드 이름 앞에 붙는다) */
  legend: string
  rewards: readonly RewardConfig[]
  onChange: (rewards: RewardConfig[]) => void
  /** 쿠폰 보상에서 고를 쿠폰 정의 - 없으면 id 를 직접 적는다 */
  coupons?: readonly CouponChoice[]
  /**
   * 배지 보상에서 고를 배지 정의(앱이 `badge` 모듈을 조립했을 때 준다). **주면 「배지」 종류가 보인다** - 안 주면 종류 선택지에 없다.
   * 이미 배지 보상이 저장된 줄은 안 줘도 그대로 보이고(코드를 적는 칸) 고칠 수 있다. 보관된 배지는 목록에서 빼도 저장된 값은 선택지로 남는다
   */
  badges?: readonly BadgeChoice[]
  labels?: Partial<RewardsAdminLabels>
}

const blank = (type: string): RewardConfig =>
  type === 'coupon'
    ? { type, params: { definitionId: '' } }
    : type === 'badge'
      ? { type, params: { code: '' } }
      : { type: 'point', params: { amount: '' } }

/** 보상 목록 편집 - 줄마다 종류(포인트 · 쿠폰)와 지급기 값. 유효기간은 비우면 보내지 않는다(서버가 정한다) */
export function RewardListEditor({
  legend,
  rewards,
  onChange,
  coupons,
  badges,
  labels: given,
}: RewardListEditorProps) {
  const all = mergeAdminLabels(given)
  const t = all.rewardEditor
  const set = (index: number, next: RewardConfig) =>
    onChange(rewards.map((r, i) => (i === index ? next : r)))
  const param = (reward: RewardConfig, key: string, value: string): RewardConfig => {
    const params = { ...reward.params }
    if (value === '') delete params[key]
    else params[key] = value
    return { ...reward, params }
  }
  return (
    <fieldset className={styles.list}>
      <legend>{legend}</legend>
      {rewards.length === 0 && <p className={styles.muted}>{t.none}</p>}
      {rewards.map((reward, index) => (
        <div key={index} className={styles.row}>
          <Field label={`${legend} ${index + 1} ${t.type}`}>
            {(control) => (
              <Select
                {...control}
                value={reward.type}
                onChange={(event) => set(index, blank(event.target.value))}
              >
                <option value="point">{t.types.point}</option>
                <option value="coupon">{t.types.coupon}</option>
                {(badges || reward.type === 'badge') && (
                  <option value="badge">{t.types.badge}</option>
                )}
              </Select>
            )}
          </Field>
          {reward.type === 'coupon' ? (
            <Field label={`${legend} ${index + 1} ${t.definition}`}>
              {(control) =>
                coupons ? (
                  <Select
                    {...control}
                    value={reward.params.definitionId ?? ''}
                    onChange={(event) =>
                      set(index, param(reward, 'definitionId', event.target.value))
                    }
                  >
                    <option value="" />
                    {coupons.map((coupon) => (
                      <option key={coupon.id} value={coupon.id}>
                        {coupon.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...control}
                    value={reward.params.definitionId ?? ''}
                    onChange={(event) =>
                      set(index, param(reward, 'definitionId', event.target.value))
                    }
                  />
                )
              }
            </Field>
          ) : reward.type === 'badge' ? (
            <Field label={`${legend} ${index + 1} ${t.badge}`}>
              {(control) =>
                badges ? (
                  <Select
                    {...control}
                    value={reward.params.code ?? ''}
                    onChange={(event) => set(index, param(reward, 'code', event.target.value))}
                  >
                    <option value="" />
                    {badges.map((badge) => (
                      <option key={badge.code} value={badge.code}>
                        {badge.name}
                      </option>
                    ))}
                    {/* 저장된 값이 목록에 없으면(보관된 배지) 값이 조용히 비지 않게 코드 그대로 남긴다 */}
                    {reward.params.code && !badges.some((b) => b.code === reward.params.code) && (
                      <option value={reward.params.code}>{reward.params.code}</option>
                    )}
                  </Select>
                ) : (
                  <Input
                    {...control}
                    value={reward.params.code ?? ''}
                    onChange={(event) => set(index, param(reward, 'code', event.target.value))}
                  />
                )
              }
            </Field>
          ) : (
            <>
              <Field label={`${legend} ${index + 1} ${t.amount}`}>
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min={1}
                    value={reward.params.amount ?? ''}
                    onChange={(event) => set(index, param(reward, 'amount', event.target.value))}
                  />
                )}
              </Field>
              <Field label={`${legend} ${index + 1} ${t.expiresInDays}`}>
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min={1}
                    value={reward.params.expiresInDays ?? ''}
                    onChange={(event) =>
                      set(index, param(reward, 'expiresInDays', event.target.value))
                    }
                  />
                )}
              </Field>
            </>
          )}
          <Button
            variant="danger"
            size="sm"
            aria-label={`${legend}: ${t.remove(index + 1)}`}
            onClick={() => onChange(rewards.filter((_, i) => i !== index))}
          >
            {all.remove}
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...rewards, blank('point')])}
        >
          {t.add}
        </Button>
      </div>
    </fieldset>
  )
}
