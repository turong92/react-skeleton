import type { InquiryLabels } from './labels'

export const koInquiryLabels: InquiryLabels = {
  form: {
    kind: '종류',
    kinds: { QUESTION: '질문', FEATURE: '제안', BUG: '오류', OTHER: '기타' },
    body: '내용',
    bodyHint: '필요한 것을 알려 주세요. 10자 이상 적어 주세요.',
    bodyCount: (length, max) => `${length} / ${max}`,
    bodyTooShort: (min, max) => `${min}~${max}자로 적어 주세요.`,
    email: '답장 받을 이메일 (선택)',
    emailHintSignedOut: '비워 두면 답장을 드릴 수 없어요.',
    emailHintSignedIn: '이 문의에 답장하는 데만 써요.',
    emailInvalid: '이메일 주소 모양이 아니에요.',
    submit: '보내기',
    sending: '보내는 중',
  },
  errors: {
    invalid: '값이 올바르지 않아요. 내용을 확인하고 다시 보내 주세요.',
    captcha: '사람인지 확인하지 못했어요. 다시 시도해 주세요.',
    tooMany: '문의가 너무 잦아요. 잠시 뒤에 다시 보내 주세요.',
    other: '문의를 보내지 못했어요. 다시 시도해 주세요.',
  },
}
