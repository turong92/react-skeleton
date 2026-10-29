import { defaultRewardsLabels, koRewardsLabels, type RewardsLabels } from '@skeleton/rewards'
import {
  defaultRewardsAdminLabels,
  koRewardsAdminLabels,
  type RewardsAdminLabels,
} from '@skeleton/rewards/admin'

/**
 * 보상 화면의 문구 - 패키지 사전을 언어에 맞게 고른다. 이 앱의 말 사전은 「프로필」이라는 말을 쓰지 않는다(필명이 하나의 개념이다)
 * 그래서 배지 스위치의 문구만 「공개 배지」로 바꾼다.
 */
export const rewardsLabelsFor = (language: 'ko' | 'en'): RewardsLabels => {
  const base = language === 'ko' ? koRewardsLabels : defaultRewardsLabels
  const show =
    language === 'ko'
      ? {
          showOnProfile: '공개 배지에 보이기',
          showOnProfileFor: (name: string) => `${name}: 공개 배지에 보이기`,
          profileTitle: '공개 배지',
        }
      : {
          showOnProfile: 'Show in public badges',
          showOnProfileFor: (name: string) => `${name}: show in public badges`,
          profileTitle: 'Public badges',
        }
  return { ...base, badge: { ...base.badge, ...show } }
}

export const rewardsAdminLabelsFor = (language: 'ko' | 'en'): RewardsAdminLabels =>
  language === 'ko' ? koRewardsAdminLabels : defaultRewardsAdminLabels
