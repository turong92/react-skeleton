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
}

export const defaultPlayQueueLabels: PlayQueueLabels = {
  miniPlayer: 'Now playing',
  play: 'Play',
  pause: 'Pause',
  next: 'Next song',
  seek: 'Seek',
  open: (title) => `Open ${title}`,
}

export const koPlayQueueLabels: PlayQueueLabels = {
  miniPlayer: '지금 재생 중',
  play: '재생',
  pause: '일시정지',
  next: '다음 곡',
  seek: '재생 위치',
  open: (title) => `${title} 크게 보기`,
}
