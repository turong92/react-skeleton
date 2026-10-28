import type { CouponStage } from '../types'

/** 단계는 다섯까지 - 그 이상은 쿠폰 문구로 설명이 안 된다 */
export const MAX_STAGES = 5
const MAX_FREE_MONTHS = 36

const base = (): CouponStage => ({ type: 'PERCENT', value: 10, maxDiscount: null, periods: 1 })

/** 새 단계(한 번, 10%)를 끝에 더한다. 끝이 「영원」이었다면 그 단계를 한 번으로 바꾼다 - 영원은 마지막 단계만 */
export function addStage(stages: readonly CouponStage[]): CouponStage[] {
  if (stages.length >= MAX_STAGES) return [...stages]
  const settled = stages.map((s, i) =>
    i === stages.length - 1 && s.periods === null ? { ...s, periods: 1 } : s,
  )
  return [...settled, base()]
}

export function removeStage(stages: readonly CouponStage[], index: number): CouponStage[] {
  return stages.filter((_, i) => i !== index)
}

/** 무료에서 다른 종류로 바꿀 때 시작하는 값 - 0 으로 두면 「0% 할인」이 된다 */
const START_VALUE = { PERCENT: 10, FIXED: 1000 } as const

/**
 * 한 단계의 칸을 고친다. 무료로 바꾸면 값과 상한을 비우고, 무료에서 바꾸면 쓸 만한 값으로 시작하며,
 * 정률은 100 을 넘지 못하고 상한은 정률에만 있다
 */
export function updateStage(
  stages: readonly CouponStage[],
  index: number,
  patch: Partial<CouponStage>,
): CouponStage[] {
  return stages.map((s, i) => {
    if (i !== index) return s
    const next = { ...s, ...patch }
    if (next.type === 'FREE') return { ...next, value: 0, maxDiscount: null }
    if (s.type === 'FREE' && patch.value === undefined) next.value = START_VALUE[next.type]
    if (next.type === 'PERCENT') next.value = Math.min(100, Math.max(0, next.value))
    else next.maxDiscount = null
    return next
  })
}

/** 「영원」 켜고 끄기 - 마지막 단계만 켤 수 있다(다른 단계는 그대로) */
export function setForever(
  stages: readonly CouponStage[],
  index: number,
  forever: boolean,
): CouponStage[] {
  if (forever && index !== stages.length - 1) return [...stages]
  return updateStage(stages, index, { periods: forever ? null : 1 })
}

/** 「무료 이용권」 틀 - 한 번 무료 */
export const freeVoucher = (): CouponStage[] => [
  { type: 'FREE', value: 0, maxDiscount: null, periods: 1 },
]

/** 「n달 무료」 틀 - 1 에서 36 사이로 맞춘다 */
export function freeMonths(months: number): CouponStage[] {
  const n = Math.min(MAX_FREE_MONTHS, Math.max(1, Math.trunc(months) || 1))
  return [{ type: 'FREE', value: 0, maxDiscount: null, periods: n }]
}
