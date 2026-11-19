import { defaultInquiryLabels, koInquiryLabels, type InquiryLabels } from '@skeleton/inquiry'

export const inquiryLabelsFor = (language: 'ko' | 'en'): InquiryLabels =>
  language === 'ko' ? koInquiryLabels : defaultInquiryLabels
