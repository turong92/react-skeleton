import type { AuthorMemory } from './authorMemory'
import type { AuthorProfileLabels } from './labels'
import type { AuthorProfile } from './types'

/** 게시판 `authorPicker` 렌더 함수가 받는 것(`@skeleton/board` 의 `AuthorPickerArgs` 와 같은 모양 — 이 패키지는 보드를 import 하지 않는다) */
export type AuthorPickerSlotProps = {
  /** 지금 고른 프로필 id — 없으면 undefined(골라야 보낼 수 있다) */
  value: string | undefined
  onChange: (authorId: string | undefined) => void
  /** 이 스레드에서 내가 마지막으로 쓴 프로필 id */
  threadAuthorId: string | undefined
  /** 댓글을 아직 받는 중 — true 인 동안은 처음 값을 확정하지 않는다(기기 기억으로도 넘어가지 않는다) */
  threadLoading: boolean
  /** 칸 오류 문장이 보이는 중인가 */
  invalid: boolean
  disabled: boolean
  /**
   * 선택기에 **답이 필요한 질문**(한 줄 확인)이 떠 있는가를 폼에 알린다 — true 인 동안 폼은 제출을 막고 포커스를 확인 줄로 보낸다
   * (확정되지 않은 값으로 글이 나가지 않게). 선택기가 스스로 닫거나 풀리면 false. 폼은 안정된 함수를 준다
   */
  onUnsettledChange: (unsettled: boolean) => void
  /** 칸 오류 문장의 id — 선택기 단추에 `aria-describedby` 로 잇는다 */
  'aria-describedby'?: string
}

export type AuthorPickerViewProps = AuthorPickerSlotProps & {
  /** 지금 살아 있는 내 프로필 */
  profiles: readonly AuthorProfile[]
  /** 이 선택기가 쓰는 게시판 — 기기 기억의 칸 */
  boardCode: string
  /** 있으면 처음 값(②)을 읽고 사람이 고른 것을 쓴다 */
  memory?: AuthorMemory
  /** 프로필이 하나도 없을 때 「프로필 만들기」 단추가 부르는 앱의 진입(관리 화면으로 가기 · 만들기 창 열기) */
  onCreateProfile?: (event: { currentTarget: Element }) => void
  /** 「프로필 만들기」가 창(대화상자)을 여는가 — 기본 false(화면 이동 · 다른 동작). `useProfileDialog` 로 창을 여는 앱은 true 로 줘서 낭독기에 창이 열린다고 말하게 한다(`aria-haspopup="dialog"`) */
  createOpensDialog?: boolean
  labels?: Partial<AuthorProfileLabels>
}
