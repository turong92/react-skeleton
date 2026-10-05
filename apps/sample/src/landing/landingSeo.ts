import { faqLd } from '@skeleton/seo'
import type { MessageKey } from '../i18n'

type Translate = (key: MessageKey) => string

/** 랜딩의 구조화 데이터 — 화면의 FAQ 와 같은 글(`landing.faq.*`)에서 만든다 */
export const landingJsonLd = (t: Translate) => [
  faqLd(
    (['1', '2', '3'] as const).map((n) => ({
      question: t(`landing.faq.q${n}`),
      answer: t(`landing.faq.a${n}`),
    })),
  ),
]
