import type { ReactNode } from 'react'
import type { GuestCredentials } from './types'

/** 댓글 폼이 본문 말고 더 보내는 것 — 비어 있으면 아예 넘기지 않는다 */
export type CommentSubmitExtra = {
  /** 로그인하지 않고 새 댓글 · 답글을 쓸 때 */
  guest?: GuestCredentials
  /** 비회원이 자기 댓글을 고칠 때의 비밀(헤더로만 나간다) */
  guestSecret?: string
  /** 첨부 저장 키 — `attachmentPicker` 가 있을 때 */
  attachments?: string[]
}

/** 첨부 고르는 자리 — 업로드는 앱 몫이다(저장 키 문자열만 오간다). `max` 는 `BoardConfig.commentMaxAttachments` */
export type AttachmentPicker = (args: {
  value: string[]
  onChange: (keys: string[]) => void
  max: number
}) => ReactNode
