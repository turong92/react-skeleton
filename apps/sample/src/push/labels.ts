import { defaultPushLabels, koPushLabels, type PushLabels } from '@skeleton/push'
import { koAdvertisingLabels, type AdvertisingLabelsInput } from '@skeleton/push/advertising'

/** 푸시 문구 — 한국어는 패키지의 사전, 그 밖에는 기본(영어). 종류 이름은 앱 사전(`notificationType.*`)에서 받는다 */
export function pushLabelsFor(ko: boolean, typeNames: Record<string, string>): PushLabels {
  const base = ko ? koPushLabels : defaultPushLabels
  return {
    ...base,
    settings: { ...base.settings, types: { ...base.settings.types, names: typeNames } },
  }
}

export const advertisingLabelsFor = (ko: boolean): AdvertisingLabelsInput | undefined =>
  ko ? koAdvertisingLabels : undefined
