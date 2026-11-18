/** `MiniPlayer` 의 화면 문구 - 기본은 영어, `koPlayQueueLabels` 는 한국어. 일부만 바꿀 때는 `{ ...defaultPlayQueueLabels, … }` */
export type PlayQueueLabels = {
  /** 작은 재생기 영역의 낭독 이름 */
  miniPlayer: string
  play: string
  pause: string
  next: string
  /** 진행 막대(끌어서 옮기는 칸)의 이름 */
  seek: string
  /** 눌러 큰 화면으로 - `title` 은 지금 곡 */
  open: (title: string) => string
  /** 소리 나올 장치 고르기(앱의 메뉴가 쓴다) - 메뉴 항목 이름 */
  outputDevice: string
  /** 장치를 고르지 않은 상태(브라우저 기본) */
  outputDefault: string
  /** 이름을 읽지 못한 장치(`n` 은 1부터) */
  outputUnnamed: (n: number) => string
  /** 지금 곡의 소리는 유튜브 틀에서 나서 고른 장치를 따르지 못한다 */
  outputOnFrame: string
}

export const defaultPlayQueueLabels: PlayQueueLabels = {
  miniPlayer: 'Now playing',
  play: 'Play',
  pause: 'Pause',
  next: 'Next song',
  seek: 'Seek',
  open: (title) => `Open ${title}`,
  outputDevice: 'Output device',
  outputDefault: 'Default',
  outputUnnamed: (n) => `Speaker ${n}`,
  outputOnFrame: 'This one plays through the default speaker',
}

export const koPlayQueueLabels: PlayQueueLabels = {
  miniPlayer: '지금 재생 중',
  play: '재생',
  pause: '일시정지',
  next: '다음 곡',
  seek: '재생 위치',
  open: (title) => `${title} 크게 보기`,
  outputDevice: '출력 장치',
  outputDefault: '기본 장치',
  outputUnnamed: (n) => `스피커 ${n}`,
  outputOnFrame: '이 곡은 기본 스피커로 나와',
}
