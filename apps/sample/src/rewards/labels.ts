import { defaultRewardsLabels, koRewardsLabels, type RewardsLabels } from '@skeleton/rewards'
import {
  defaultRewardsAdminLabels,
  koRewardsAdminLabels,
  type RewardsAdminLabels,
} from '@skeleton/rewards/admin'

/** 보상 화면의 문구 - 패키지 사전을 언어에 맞게 고른다(이 앱이 덮어 쓸 말은 아직 없다) */
export const rewardsLabelsFor = (language: 'ko' | 'en'): RewardsLabels =>
  language === 'ko' ? koRewardsLabels : defaultRewardsLabels

export const rewardsAdminLabelsFor = (language: 'ko' | 'en'): RewardsAdminLabels =>
  language === 'ko' ? koRewardsAdminLabels : defaultRewardsAdminLabels
