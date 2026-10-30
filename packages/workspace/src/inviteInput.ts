import type { WorkspaceDetail } from './types'

/** 서버가 한 번에 받는 주소 수 */
export const MAX_INVITE_EMAILS = 20
/** 서버 `workspace_invitations.email varchar(254)` */
const EMAIL_MAX = 254
const SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export type ParsedEmails = {
  /** 올바른 주소 — 소문자, 중복 없이, 적은 순서대로 */
  emails: string[]
  /** 모양이 틀린 것(적은 그대로) */
  invalid: string[]
  /** 올바른 주소가 한 번에 보낼 수 있는 수를 넘는다 */
  tooMany: boolean
}

/** 입력칸 글을 주소들로 — 쉼표 · 세미콜론 · 공백 · 줄바꿈으로 나눈다 */
export function parseInviteEmails(text: string): ParsedEmails {
  const emails: string[] = []
  const invalid: string[] = []
  for (const word of text.split(/[\s,;]+/)) {
    if (word === '') continue
    if (word.length > EMAIL_MAX || !SHAPE.test(word)) invalid.push(word)
    else if (!emails.includes(word.toLowerCase())) emails.push(word.toLowerCase())
  }
  return { emails, invalid, tooMany: emails.length > MAX_INVITE_EMAILS }
}

export type SeatUsage = { used: number; limit: number; left: number; full: boolean }

/** 좌석 = 멤버 + 살아 있는 대기 초대. 상한이 없으면 null(앱이 정하지 않았다) */
export function seatUsage(
  workspace: Pick<WorkspaceDetail, 'memberCount' | 'pendingInvitations' | 'seatLimit'>,
): SeatUsage | null {
  const limit = workspace.seatLimit
  if (limit === null || limit === undefined) return null
  const used = workspace.memberCount + workspace.pendingInvitations
  const left = Math.max(0, limit - used)
  return { used, limit, left, full: left === 0 }
}
