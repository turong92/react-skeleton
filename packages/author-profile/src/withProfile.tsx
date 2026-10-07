import { Fragment, type ReactNode } from 'react'
import { ProfileIdentity, type ProfileParts } from './ProfileIdentity'

const SENTINEL = '\u0001profile\u0001'

/**
 * 앱이 번역한 문구 함수(`labels.switchConfirm(name)` 같은 `(이름) => 문장`)에 이름 자리 표지를 넣어 한 번 불러 문장을 앞 · 뒤로 나누고,
 * 그 자리(이름이 문장에 여러 번 들어가면 모든 자리)에 `ProfileIdentity` 를 끼운다 — **그래서 문구 함수는 렌더 때 표지로 한 번 더 불린다**(부수 효과가 없어야 한다) — 문장 속 이름도 이름만 말줄임이고 꼬리표는 고정이다. 문구가 이름을 그대로 넣지 않으면(표지가 없으면) 있는 그대로의 글자.
 */
export function withProfile(template: (shown: string) => string, parts: ProfileParts): ReactNode {
  const pieces = template(SENTINEL).split(SENTINEL)
  if (pieces.length === 1) return pieces[0] // 문구가 이름을 넣지 않는다 — 있는 그대로
  return pieces.map((piece, index) => (
    <Fragment key={index}>
      {index > 0 && <ProfileIdentity {...parts} />}
      {piece}
    </Fragment>
  ))
}
