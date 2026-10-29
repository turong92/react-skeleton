import type { AchievementStepConfig, CampaignConfig, RewardConfig } from './types'

/** 서버 한도(`AchievementConfig`) - 수치 이름 형식 · 단계 수 */
export const ACHIEVEMENT_METRIC = /^[a-z0-9._-]{1,64}$/
export const MAX_ACHIEVEMENT_STEPS = 20

export type AchievementProblems = {
  /** 수치 이름이 비었거나 형식이 틀렸다 */
  metric: boolean
  /** 단계가 0개이거나 한도를 넘었다 */
  count: boolean
  /** 단계마다 - 기준값이 1 이상이 아니거나 앞 단계보다 크지 않다 */
  value: boolean[]
  /** 단계마다 - 보상이 없거나, 값이 빈 보상이 있다 */
  rewards: boolean[]
}

/** 보상 한 줄이 채워졌는가 - 지급기마다 꼭 필요한 값(포인트 `amount` · 쿠폰 `definitionId` · 배지 `code`) */
const filled = (reward: RewardConfig) => {
  const key =
    reward.type === 'coupon' ? 'definitionId' : reward.type === 'badge' ? 'code' : 'amount'
  return (reward.params[key] ?? '').trim() !== ''
}

/**
 * 업적 이벤트 설정을 저장 전에 로컬에서 본다 - 서버가 400(`CAMPAIGN.CONFIG_INVALID`)으로 거절할 것을 칸마다 미리 알린다.
 * 조건: 수치 이름 `[a-z0-9._-]{1,64}` · 단계 1~20개 · 기준값 1 이상의 엄격한 오름차순 · 단계마다 보상 1개 이상(값이 채워진)
 */
export function achievementProblems(config: CampaignConfig): AchievementProblems {
  const steps = (config.milestones ?? []) as AchievementStepConfig[]
  return {
    // 서버는 앞뒤 공백을 걷어 낸 뒤 검사한다(`AchievementConfig.parse`)
    metric: !ACHIEVEMENT_METRIC.test((config.metric ?? '').trim()),
    count: steps.length < 1 || steps.length > MAX_ACHIEVEMENT_STEPS,
    value: steps.map(
      (step, i) => !(step.value >= 1) || (i > 0 && step.value <= steps[i - 1].value),
    ),
    rewards: steps.map((step) => step.rewards.length === 0 || !step.rewards.every(filled)),
  }
}

export const hasAchievementProblem = (p: AchievementProblems) =>
  p.metric || p.count || p.value.some(Boolean) || p.rewards.some(Boolean)
