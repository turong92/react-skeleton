import type { ReactNode } from 'react'
import { ProfileIdentity, type ProfileParts } from './ProfileIdentity'

const SENTINEL = '\u0001profile\u0001'

/**
 * 앱이 번역한 문구 함수(`labels.switchConfirm(name)` 같은 `(이름) => 문장`)에 이름 자리 표지를 넣어 한 번 불러 문장을 앞 · 뒤로 나누고,
 * 그 자리에 `ProfileIdentity` 를 끼운다 — 문장 속 이름도 이름만 말줄임이고 꼬리표는 고정이다. 문구가 이름을 그대로 넣지 않으면(표지가 없으면) 있는 그대로의 글자.
 */
export function withProfile(template: (shown: string) => string, parts: ProfileParts): ReactNode {
  const text = template(SENTINEL)
  const at = text.indexOf(SENTINEL)
  if (at === -1) return text
  return (
    <>
      {text.slice(0, at)}
      <ProfileIdentity {...parts} />
      {text.slice(at + SENTINEL.length)}
    </>
  )
}
