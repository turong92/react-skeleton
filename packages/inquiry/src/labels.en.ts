import type { InquiryLabels } from './labels'

export const defaultInquiryLabels: InquiryLabels = {
  form: {
    kind: 'Kind',
    kinds: { QUESTION: 'Question', FEATURE: 'Idea', BUG: 'Problem', OTHER: 'Other' },
    body: 'Message',
    bodyHint: 'Tell us what you need — at least 10 characters.',
    bodyCount: (length, max) => `${length} / ${max}`,
    bodyTooShort: (min, max) => `Write ${min} to ${max} characters.`,
    email: 'Email for a reply (optional)',
    emailHintSignedOut: 'Leave it empty and we cannot write back.',
    emailHintSignedIn: 'We only use it to reply to this message.',
    emailInvalid: 'That does not look like an email address.',
    submit: 'Send',
    sending: 'Sending',
  },
  errors: {
    invalid: 'Some of the values are not right. Check the message and try again.',
    captcha: 'We could not confirm you are human. Try again.',
    tooMany: 'You have sent a lot of messages. Please try again a little later.',
    other: 'We could not send your message. Please try again.',
  },
}
