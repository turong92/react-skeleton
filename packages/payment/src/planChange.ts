import { periodMinutes } from './planGroups'
import type { PlanChangeTiming, SubscriptionPlan } from './subscriptionTypes'

/** 지금 구독의 등급 · 주기 · 통화 - 바꿀 플랜을 가르는 기준 */
export type CurrentTier = { level: number; period: string; currency: string }

/**
 * 구독을 target 으로 바꾸면 언제 적용되나 - 서버(`PlanChangeRules.classify`)와 같은 표의 화면 쪽 짐작이다(창이 선택지를 묶는 데만 쓰고, 확인 창의 최종 판단은 서버 미리보기의 `timing`).
 * 등급이 낮아지면 주기와 상관없이 예약, 등급이 같거나 높고 주기가 길어지면 바로(새 주기), 같은 주기에서 등급이 오르면 바로, 주기가 짧아지면 예약.
 * 등급도 주기도 같으면 바꿀 게 없고(`null`), 통화가 다르면 바꾸지 않는다(`null`)
 */
export function planChangeTiming(
  current: CurrentTier,
  target: Pick<SubscriptionPlan, 'level' | 'period' | 'amount'>,
): PlanChangeTiming | null {
  if (target.amount.currency !== current.currency) return null
  if (target.level < current.level) return 'NEXT_RENEWAL'
  const longer = periodMinutes(target.period) - periodMinutes(current.period)
  if (longer > 0) return 'NOW'
  if (longer < 0) return 'NEXT_RENEWAL'
  return target.level > current.level ? 'NOW' : null
}

/** 바꿀 수 있는 플랜을 「바로」와 「다음 결제일부터」로 나눈다 - 지금 플랜(코드)과 바꿀 게 없는 플랜은 뺀다 */
export function changeChoices(
  plans: readonly SubscriptionPlan[],
  current: CurrentTier,
  currentPlanCode?: string,
): { now: SubscriptionPlan[]; next: SubscriptionPlan[] } {
  const now: SubscriptionPlan[] = []
  const next: SubscriptionPlan[] = []
  for (const plan of plans) {
    if (plan.code === currentPlanCode) continue
    const timing = planChangeTiming(current, plan)
    if (timing === 'NOW') now.push(plan)
    else if (timing === 'NEXT_RENEWAL') next.push(plan)
  }
  return { now, next }
}

/**
 * 후보 순서 - 지금 주기와 같은 주기의 플랜이 먼저(바로 위 등급부터), 그다음 더 긴 주기.
 * 첫 후보가 창의 기본 선택이라, 결제사에 연 가격이 아직 없어도 창이 열리자마자 거절되지 않게 같은 주기 윗등급을 앞에 둔다
 */
export function sameCycleFirst(
  plans: readonly SubscriptionPlan[],
  current: Pick<CurrentTier, 'period'>,
): SubscriptionPlan[] {
  const rank = (plan: SubscriptionPlan) => (plan.period === current.period ? 0 : 1)
  return [...plans].sort((a, b) => rank(a) - rank(b) || a.level - b.level)
}
