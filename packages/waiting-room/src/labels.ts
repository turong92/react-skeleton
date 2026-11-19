import { defaultWaitingRoomLabels } from './labels.en'

export type WaitingRoomLabels = {
  screen: {
    joining: string
    prequeueTitle: string
    /** `clock` 은 `1:02:03` 꼴 */
    opensIn: (clock: string) => string
    prequeueNote: string
    waitingTitle: string
    yourNumber: (position: number) => string
    ahead: (count: number) => string
    estimate: (seconds: number) => string
    /** 입장이 멈춰서 예상 시간을 못 낼 때 */
    estimateUnknown: string
    /** 진행 막대의 낭독 이름 */
    progress: string
    keepPlace: string
    admittedTitle: string
    expiredTitle: string
    expiredBody: string
    rejoin: string
    closedTitle: string
    closedBody: string
    retrying: string
  }
  /** 페이지 앞 문에서 입장 시간이 끝났을 때 children 위에 붙는 띠 */
  entryExpired: string
}

/** 일부만 바꾸는 입력 */
export type WaitingRoomLabelsInput = {
  screen?: Partial<WaitingRoomLabels['screen']>
  entryExpired?: string
}

export { defaultWaitingRoomLabels } from './labels.en'
export { koWaitingRoomLabels } from './labels.ko'

export function resolveWaitingRoomLabels(input: WaitingRoomLabelsInput = {}): WaitingRoomLabels {
  return {
    screen: { ...defaultWaitingRoomLabels.screen, ...input.screen },
    entryExpired: input.entryExpired ?? defaultWaitingRoomLabels.entryExpired,
  }
}
