import type { QueueStorage } from './queueStorage'

/** 소리 나올 장치 하나 - `label` 은 마이크 권한 전에는 비어 있다 */
export type OutputDeviceOption = { deviceId: string; label: string }

/** `navigator.mediaDevices` 가 하는 만큼 - 시험에서는 가짜로 바꿔 끼운다 */
export type MediaDevicesLike = {
  enumerateDevices?: () => Promise<Array<{ kind: string; deviceId: string; label: string }>>
  getUserMedia?: (constraints: { audio: boolean }) => Promise<{ getTracks: () => Array<{ stop: () => void }> }>
  addEventListener?: (type: 'devicechange', listener: () => void) => void
  removeEventListener?: (type: 'devicechange', listener: () => void) => void
}

/** 브라우저가 목록에 끼워 넣는 가상 항목 - 「기본 장치」는 빈 값으로 따로 고른다 */
const VIRTUAL_DEVICES: readonly string[] = ['default', 'communications']
export const isRealOutput = (device: OutputDeviceOption) => !VIRTUAL_DEVICES.includes(device.deviceId)

/** 이 브라우저가 요소의 소리 장치를 고를 수 있나(`setSinkId` - 사파리 · 파이어폭스 일부는 없다) */
export function canChooseOutput(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
}

/** 요소를 장치에 건다. 빈 값은 기본 장치. 못 거는 요소 · 거절된 장치는 조용히 넘어간다(소리는 지금 장치에서 계속 난다) */
export function applySink(el: { setSinkId?: (id: string) => Promise<void> } | null, id: string) {
  try {
    el?.setSinkId?.(id)?.catch(() => {})
  } catch {
    // 이 요소는 장치를 못 고른다
  }
}

/** 소리 나올 수 있는 장치 전부(가상 항목 포함 - 사라졌는지 가릴 때 쓴다). 못 읽으면 빈 목록 */
export async function listOutputDevices(
  media: MediaDevicesLike | undefined,
): Promise<OutputDeviceOption[]> {
  try {
    const all = (await media?.enumerateDevices?.()) ?? []
    return all
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label }))
  } catch {
    return []
  }
}

/** 장치 이름은 마이크 권한을 받아야 읽힌다 - 받자마자 트랙을 멈춘다(마이크는 켜 두지 않는다). 거절되어도 조용히 */
export async function grantOutputLabels(media: MediaDevicesLike | undefined): Promise<void> {
  try {
    const stream = await media?.getUserMedia?.({ audio: true })
    stream?.getTracks().forEach((track) => track.stop())
  } catch {
    // 거절 · 마이크 없음 - 이름 없이 간다
  }
}

/** 고른 장치는 앱이 준 키로만 기억한다(이 기기 · 이 브라우저). 빈 값(기본)이면 지운다 */
export function loadOutputDevice(storage: QueueStorage | undefined, key: string | undefined): string {
  try {
    return (key && storage?.getItem(key)) || ''
  } catch {
    return ''
  }
}

export function saveOutputDevice(
  storage: QueueStorage | undefined,
  key: string | undefined,
  id: string,
): void {
  if (!key) return
  try {
    if (id) storage?.setItem(key, id)
    else storage?.removeItem(key)
  } catch {
    // 저장 실패는 삼킨다
  }
}
