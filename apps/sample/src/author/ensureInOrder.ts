/**
 * 쓰기 직전의 확인들을 **차례로** 부르고, 대화상자를 연(false) 첫 확인에서 멈춘다 - 앞의 것이 열려 있는 동안 뒤의 것을 위에 얹지 않는다.
 * 견본 앱의 순서: 이메일(`useEmailBeforeWrite`) → 닉네임(`useProfileGate`). 사용자가 앞의 것을 마치고 다시 누르면 다음 확인이 열린다
 */
export function ensureInOrder(...checks: Array<() => boolean>): boolean {
  for (const check of checks) if (!check()) return false
  return true
}
