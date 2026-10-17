import type { ReactNode } from 'react'
import type { GuestCredentials, GuestSecretKind } from './types'

/**
 * 로그인하지 않고 쓰는 화면의 설정 — 앱이 `BoardConfig.guestEnabled` · 게시판 `settings.guestWrite` 와 로그인 여부로 정해 준다
 * (있을 때만 비회원 칸이 그려진다).
 */
export type GuestUi = {
  /** `BoardConfig.guestSecret` — `PASSWORD`: 사람이 치는 값(칸을 그린다) · `TOKEN`: 앱이 만든 `token` 을 쓴다(칸 없음) */
  secretKind: GuestSecretKind
  nameMaxLength: number
  /** `TOKEN` 방식에서 앱이 만들어 들고 있는 무작위 값 — 고치기 · 지우기에도 같은 값이 간다 */
  token?: string
  /** `BoardConfig.captchaRequired` */
  captchaRequired?: boolean
  /** 캡차 위젯 자리 — 토큰을 얻으면 `onToken` 으로 올린다(만료 · 실패면 undefined) */
  renderCaptcha?: (onToken: (token: string | undefined) => void) => ReactNode
}

/** 비회원 칸에 친 값 */
export type GuestDraft = { name: string; secret: string; captchaToken?: string }

export const emptyGuestDraft: GuestDraft = { name: '', secret: '' }

export const MIN_GUEST_SECRET = 4

/** 칸마다 한 줄 오류 — 비면 통과. 문구는 부르는 쪽이 준 라벨 */
export function guestProblems(
  draft: GuestDraft,
  ui: GuestUi,
  labels: {
    guestNameRequired: string
    guestNameTooLong: (max: number) => string
    guestSecretRequired: string
    guestCaptchaRequired: string
  },
): Partial<Record<'name' | 'secret' | 'captcha', string>> {
  const found: Partial<Record<'name' | 'secret' | 'captcha', string>> = {}
  const name = draft.name.trim()
  if (!name) found.name = labels.guestNameRequired
  else if (name.length > ui.nameMaxLength) found.name = labels.guestNameTooLong(ui.nameMaxLength)
  if (ui.secretKind === 'PASSWORD' && draft.secret.length < MIN_GUEST_SECRET)
    found.secret = labels.guestSecretRequired
  if (ui.secretKind === 'TOKEN' && !ui.token) found.secret = labels.guestSecretRequired
  if (ui.captchaRequired && !draft.captchaToken) found.captcha = labels.guestCaptchaRequired
  return found
}

/** 서버로 보낼 값 — 비밀은 `PASSWORD` 면 친 값, `TOKEN` 이면 앱의 토큰 */
export function guestCredentials(draft: GuestDraft, ui: GuestUi): GuestCredentials {
  return {
    name: draft.name.trim(),
    secret: ui.secretKind === 'TOKEN' ? (ui.token ?? '') : draft.secret,
    ...(draft.captchaToken ? { captchaToken: draft.captchaToken } : {}),
  }
}
