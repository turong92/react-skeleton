import { useCallback, useSyncExternalStore } from 'react'
import type { EmailRequiredController } from './emailRequired'

export type EmailBeforeWrite = {
  /** 이 계정은 글을 쓰기 전에 이메일이 필요하다(`me.emailRequiredToWrite`) - 댓글 칸 위의 띠(`EmailWriteNotice`)가 이걸 읽는다 */
  needed: boolean
  /**
   * 쓰기 직전에 부른다 - 이메일이 필요하면 이메일 등록 화면(쓰기용 모습)을 열고 false. 쓰던 글은 호출한 쪽이 그대로 둔다(등록이 끝난 뒤 사용자가 다시 누른다)
   * 필요 없으면(주소가 있다 · 이 앱은 안 받는다 · 로그인 직후 방식은 막이 이미 덮고 있다) 아무것도 열지 않고 true
   */
  ensure: () => boolean
}

/**
 * 쓰기 전의 이메일 확인 - 「쓰기 때」 방식의 서버(`me.emailRequiredToWrite`)에서 주소 없는 계정이 글쓰기 화면으로 가기 **전에** 등록 화면을 먼저 연다
 * (글을 다 쓴 뒤에야 막히면 제공자 왕복에서 글을 잃는다). 견본 앱의 `useProfileGate` 와 같은 모양 - `ensure()` 가 false 면 대화상자를 열었고 사용자가 등록한 뒤 다시 누른다.
 * 서버가 무엇을 요구하는지는 `EmailRequiredGate` 가 `me` 를 읽고 컨트롤러에 알린다. 그래도 빠져나간 쓰기는 403 이 받는다.
 */
export function useEmailBeforeWrite(controller: EmailRequiredController): EmailBeforeWrite {
  const when = useSyncExternalStore(controller.subscribe, controller.getWhen, controller.getWhen)
  const ensure = useCallback(() => {
    if (controller.getWhen() !== 'write') return true
    controller.require()
    return false
  }, [controller])
  return { needed: when === 'write', ensure }
}
