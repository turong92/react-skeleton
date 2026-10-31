import type { PushDeviceKind } from './types'
import { defaultPushLabels } from './labels.en'

export type PushLabels = {
  loading: string
  loadFailed: string
  retry: string
  /** 앱 안 띠(`PushPrompt`) */
  prompt: {
    title: string
    description: string
    enable: string
    later: string
  }
  settings: {
    /** 이 기기 스위치 */
    switchTitle: string
    switchDescription: string
    enableFailed: string
    disableFailed: string
    /** 켤 수 없는 까닭 — 안내만 보인다 */
    denied: { title: string; description: string }
    needsInstall: { title: string; description: string }
    unsupported: { title: string; description: string }
    /** 서버가 웹 푸시를 켜지 않았다 */
    notConfigured: { title: string; description: string }
    test: { action: string; sent: string; tooSoon: string; failed: string }
    devices: {
      title: string
      caption: string
      empty: string
      columnName: string
      columnLastSeen: string
      columnActions: string
      kind: Record<PushDeviceKind, string>
      remove: string
      removeFor: (name: string) => string
      removeFailed: string
    }
    types: {
      title: string
      description: string
      empty: string
      /** 「모든 채널 끄기」를 켠 종류의 스위치 아래 문구 */
      allMuted: string
      saveFailed: string
      /** 종류(`type`) → 화면에 보일 이름. 없는 종류는 `type` 그대로 */
      names: Record<string, string>
    }
  }
}

/** 앱이 준 일부 문구(안쪽도 일부만 가능) */
export type PushLabelsInput = {
  [K in keyof PushLabels]?: PushLabels[K] extends (...args: never[]) => unknown
    ? PushLabels[K]
    : PushLabels[K] extends object
      ? Partial<PushLabels[K]>
      : PushLabels[K]
}

export { defaultPushLabels } from './labels.en'
export { koPushLabels } from './labels.ko'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function mergeLabels<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over === undefined ? base : over) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(over))
    if (value !== undefined) out[key] = mergeLabels(base[key], value)
  return out as T
}

/** 기본 문구(영어) 위에 앱의 문구를 얹는다. 한국어는 `resolvePushLabels(koPushLabels)` */
export function resolvePushLabels(input: PushLabelsInput = {}): PushLabels {
  return mergeLabels<PushLabels>(defaultPushLabels, input)
}
