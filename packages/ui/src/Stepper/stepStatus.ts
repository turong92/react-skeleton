export type StepStatus = 'complete' | 'current' | 'upcoming'

/** 순번 → 상태 — 지금보다 앞은 끝남, 같으면 지금, 뒤는 아직 */
export const stepStatus = (index: number, current: number): StepStatus =>
  index < current ? 'complete' : index === current ? 'current' : 'upcoming'
