import type { WaitingRoomLabels } from './labels'

/** 대기 시간을 한 낱말로 - 1분 미만 · 분 · 시간 */
const wait = (seconds: number) =>
  seconds < 60
    ? '1분 미만'
    : seconds < 3600
      ? `약 ${Math.ceil(seconds / 60)}분`
      : `약 ${Math.ceil(seconds / 3600)}시간`

export const koWaitingRoomLabels: WaitingRoomLabels = {
  screen: {
    joining: '줄에 서는 중이에요…',
    prequeueTitle: '오픈 전 줄이에요',
    opensIn: (clock) => `오픈까지 ${clock}`,
    prequeueNote:
      '오픈 전에 들어온 분들은 오픈 순간에 순서가 무작위로 정해져요. 그 뒤에 온 분들은 온 순서대로 서요.',
    waitingTitle: '차례를 기다리는 중이에요',
    yourNumber: (position) => `내 번호는 ${position}번이에요`,
    ahead: (count) => `내 앞에 ${count}명`,
    estimate: (seconds) => `예상 대기 시간 ${wait(seconds)}`,
    estimateUnknown: '지금은 입장이 잠시 멈췄어요. 이 화면을 열어 두면 다시 시작할 때 이어져요.',
    progress: '줄 진행',
    keepPlace: '새로고침해도 순서는 그대로예요.',
    admittedTitle: '차례가 됐어요',
    expiredTitle: '입장 시간이 끝났어요',
    expiredBody: '다시 하려면 줄을 다시 서야 해요. 맨 뒤로 가요.',
    rejoin: '다시 줄 서기',
    closedTitle: '줄이 닫혔어요',
    closedBody: '더 이상 입장할 수 없어요.',
    retrying: '순서를 확인하지 못했어요. 다시 시도하는 중이에요…',
  },
  entryExpired: '입장 시간이 끝나 새로 시작할 수는 없어요. 하던 일은 이어서 마칠 수 있어요.',
}
