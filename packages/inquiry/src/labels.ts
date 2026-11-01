import { defaultInquiryLabels } from './labels.en'
import type { InquiryProblem } from './errors'
import type { InquiryKind } from './types'

export type InquiryLabels = {
  form: {
    kind: string
    kinds: Record<InquiryKind, string>
    body: string
    bodyHint: string
    bodyCount: (length: number, max: number) => string
    bodyTooShort: (min: number, max: number) => string
    email: string
    /** 로그인하지 않았을 때 — 비우면 답장을 못 한다는 안내 */
    emailHintSignedOut: string
    emailHintSignedIn: string
    emailInvalid: string
    submit: string
    sending: string
  }
  /** 보내기 실패 — 갈래마다 한 문장 */
  errors: Record<InquiryProblem, string>
}

/** 일부만 바꾸는 입력 */
export type InquiryLabelsInput = { [K in keyof InquiryLabels]?: Partial<InquiryLabels[K]> }

export { defaultInquiryLabels } from './labels.en'
export { koInquiryLabels } from './labels.ko'

export function resolveInquiryLabels(input: InquiryLabelsInput = {}): InquiryLabels {
  return {
    form: { ...defaultInquiryLabels.form, ...input.form },
    errors: { ...defaultInquiryLabels.errors, ...input.errors },
  }
}
