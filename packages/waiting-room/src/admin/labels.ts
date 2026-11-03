export type WaitingRoomAdminLabels = {
  title: string
  stats: {
    prequeue: string
    issued: string
    serving: string
    perMinute: string
    drain: string
    /** 입장이 멈춰 있을 때 */
    paused: string
    minutes: (seconds: number) => string
  }
  rate: {
    label: string
    hint: string
    apply: string
    pause: string
    resume: string
    invalid: string
  }
  close: {
    open: string
    title: string
    body: string
    confirm: string
    cancel: string
    done: string
  }
  loadFailed: string
  actionFailed: string
}

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60))

export const defaultWaitingRoomAdminLabels: WaitingRoomAdminLabels = {
  title: 'Waiting room',
  stats: {
    prequeue: 'In the line before the start',
    issued: 'Tickets issued',
    serving: 'Let in up to number',
    perMinute: 'Let in per minute',
    drain: 'Time until everyone is in',
    paused: 'Paused',
    minutes: (seconds) => `about ${minutes(seconds)} min`,
  },
  rate: {
    label: 'People let in per minute',
    hint: 'Applies right away. People already let in keep their entry time.',
    apply: 'Change speed',
    pause: 'Pause',
    resume: 'Resume',
    invalid: 'Enter a whole number of 1 or more.',
  },
  close: {
    open: 'Close this waiting room',
    title: 'Close this waiting room?',
    body: 'Nobody new is let in any more. This cannot be undone.',
    confirm: 'Close it',
    cancel: 'Cancel',
    done: 'This waiting room is closed.',
  },
  loadFailed: 'Could not load the numbers.',
  actionFailed: 'That did not go through. Try again.',
}

export const koWaitingRoomAdminLabels: WaitingRoomAdminLabels = {
  title: '대기실',
  stats: {
    prequeue: '오픈 전 줄',
    issued: '발급한 순번표',
    serving: '입장시킨 번호',
    perMinute: '분당 입장',
    drain: '모두 들어가기까지',
    paused: '멈춤',
    minutes: (seconds) => `약 ${minutes(seconds)}분`,
  },
  rate: {
    label: '분당 입장 수',
    hint: '바로 적용돼요. 이미 들어온 사람의 입장 시간은 그대로예요.',
    apply: '속도 바꾸기',
    pause: '멈추기',
    resume: '다시 시작',
    invalid: '1 이상의 정수를 적어 주세요.',
  },
  close: {
    open: '대기실 닫기',
    title: '대기실을 닫을까요?',
    body: '더 이상 아무도 들여보내지 않아요. 되돌릴 수 없어요.',
    confirm: '닫기',
    cancel: '취소',
    done: '대기실을 닫았어요.',
  },
  loadFailed: '숫자를 불러오지 못했어요.',
  actionFailed: '처리하지 못했어요. 다시 시도해 주세요.',
}
