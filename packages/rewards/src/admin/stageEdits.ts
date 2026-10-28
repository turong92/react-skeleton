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

/** 한 단계의 칸을 고친다. 무료로 바꾸면 값과 상한을 비운다 */
export function updateStage(
  stages: readonly CouponStage[],
  index: number,
  patch: Partial<CouponStage>,
): CouponStage[] {
  return stages.map((s, i) => {
    if (i !== index) return s
    const next = { ...s, ...patch }
    return next.type === 'FREE' ? { ...next, value: 0, maxDiscount: null } : next
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
