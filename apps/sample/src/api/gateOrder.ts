/** 막(전면 화면) 컨트롤러가 가진 부분 중 순서를 가리는 데 쓰는 것 */
type OuterGate = {
  isReady(): boolean
  getState(): { status: string }
  subscribe(listener: () => void): () => void
}

/** 바깥 막이 서버에 물어 답을 받았고(`isReady`) 열려 있지 않다 — 안쪽 막이 물어도 된다 */
const settled = (outer: OuterGate) => outer.isReady() && outer.getState().status === 'idle'

/**
 * 막의 순서는 서버 인터셉터와 같다: 아이디 → 이메일 → 약관. 안쪽 막은 **바깥 막이 확인을 마치고 걷힐 때까지** 서버에 묻지 않는다 —
 * 두 막이 함께 열리면 안쪽 화면이 바깥 막의 `inert` 아래에서 떠 첫 포커스를 잃는다. 바깥 막이 열려 있다가 정하지 않고 떠나도(로그아웃) 풀린다(그 뒤의 일은 계정이 알려 준다).
 */
export function whenOuterGateSettled(outer: OuterGate): Promise<void> {
  if (settled(outer)) return Promise.resolve()
  return new Promise((resolve) => {
    const off = outer.subscribe(() => {
      if (!settled(outer)) return
      off()
      resolve()
    })
  })
}
