const INPUTS = ['pointerdown', 'keydown', 'touchstart'] as const

/** 이 시간 안에 입력이 있었으면 그 직후의 `pause` 는 사용자가 누른 것이다 */
export const USER_PAUSE_INPUT_MS = 700

type Target = {
  addEventListener: (type: string, listener: () => void, capture: boolean) => void
  removeEventListener: (type: string, listener: () => void, capture: boolean) => void
}

/**
 * 마지막 실제 입력(누르기 · 키 · 터치)의 시각을 문서 전체에서 잡는다(capture - 영상 요소의 내장 단추를 눌러도 잡힌다).
 * `navigator.userActivation.isActive` 는 마지막 손짓 뒤 몇 초간 참이라 「재생 누르고 2초 뒤 주머니에 넣는」 경우의 OS pause 를
 * 사용자 멈춤으로 오해한다 - 그래서 입력 시각을 직접 본다
 */
export function watchInput(doc: Target, now: () => number = Date.now) {
  let at = -Infinity
  const onInput = () => {
    at = now()
  }
  for (const type of INPUTS) doc.addEventListener(type, onInput, true)
  return {
    /** 방금 `ms` 안에 입력이 있었나 */
    recent: (ms: number = USER_PAUSE_INPUT_MS) => now() - at <= ms,
    stop: () => {
      for (const type of INPUTS) doc.removeEventListener(type, onInput, true)
    },
  }
}
