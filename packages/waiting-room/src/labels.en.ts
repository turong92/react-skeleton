import type { WaitingRoomLabels } from './labels'

/** 대기 시간을 한 낱말로 - 1분 미만 · 분 · 시간 */
const wait = (seconds: number) =>
  seconds < 60
    ? 'under a minute'
    : seconds < 3600
      ? `about ${Math.ceil(seconds / 60)} min`
      : `about ${Math.ceil(seconds / 3600)} h`

export const defaultWaitingRoomLabels: WaitingRoomLabels = {
  screen: {
    joining: 'Getting you in line…',
    prequeueTitle: 'The line is open before the start',
    opensIn: (clock) => `Opens in ${clock}`,
    prequeueNote:
      'Everyone who joins before the start is placed in a random order at the moment it opens. Those who come later follow in the order they arrive.',
    waitingTitle: 'Waiting for your turn',
    yourNumber: (position) => `You are number ${position}`,
    ahead: (count) => (count === 1 ? '1 person ahead of you' : `${count} people ahead of you`),
    estimate: (seconds) => `Estimated wait: ${wait(seconds)}`,
    estimateUnknown:
      'Entry is paused for now. Keep this page open and it continues when it resumes.',
    progress: 'Progress in line',
    keepPlace: 'Your place stays the same if you refresh.',
    admittedTitle: 'It is your turn',
    expiredTitle: 'Your entry time is over',
    expiredBody: 'To try again, join the line again. You will be at the back.',
    rejoin: 'Join the line again',
    closedTitle: 'This line is closed',
    closedBody: 'Nobody is let in any more.',
    retrying: 'Could not check your place. Trying again…',
  },
  entryExpired:
    'Your entry time is over, so you cannot start anything new. You can finish what you already started.',
}
