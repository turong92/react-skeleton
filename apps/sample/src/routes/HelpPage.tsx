import { useAuth } from '@skeleton/auth'
import { Turnstile, useTurnstileToken } from '@skeleton/captcha-turnstile'
import { ContactForm, FaqList, type FaqSection } from '@skeleton/inquiry'
import { Alert, PageHeader, SectionCard } from '@skeleton/ui'
import { useState } from 'react'
import { languageOf, useT, type MessageKey } from '../i18n'
import { inquiryApi } from '../inquiry/api'
import { inquiryLabelsFor } from '../inquiry/labels'

/** 서버가 로그인하지 않은 호출에 사람 확인(Turnstile)을 켠 환경에서만 채운다 - 비우면 위젯도 토큰도 없다(서버 기본은 통과) */
const TURNSTILE_SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined

/** 문항은 이 앱의 것 - `FaqList` 는 질문 · 답을 모른다 */
const FAQ: {
  id: string
  title: MessageKey
  items: { id: string; q: MessageKey; a: MessageKey }[]
}[] = [
  {
    id: 'start',
    title: 'help.faq.start.title',
    items: [
      { id: 'write', q: 'help.faq.start.write.q', a: 'help.faq.start.write.a' },
      { id: 'attach', q: 'help.faq.start.attach.q', a: 'help.faq.start.attach.a' },
    ],
  },
  {
    id: 'account',
    title: 'help.faq.account.title',
    items: [
      { id: 'email', q: 'help.faq.account.email.q', a: 'help.faq.account.email.a' },
      { id: 'leave', q: 'help.faq.account.leave.q', a: 'help.faq.account.leave.a' },
    ],
  },
]

/**
 * 도움말 `/help` - 자주 묻는 질문 + 문의 폼. 로그인 없이 열린다. 보내면 `context` 로 화면 이름(`screen:help`)이 운영자 목록에 같이 보인다.
 * 로그인했으면 확인된 이메일이 채워지고 사람 확인이 없다.
 */
export function HelpPage() {
  const { t, locale } = useT()
  const { principal } = useAuth()
  const turnstile = useTurnstileToken()
  const [sent, setSent] = useState<{ hasEmail: boolean } | null>(null)
  const sections: FaqSection[] = FAQ.map((section) => ({
    id: section.id,
    title: t(section.title),
    items: section.items.map((item) => ({
      id: item.id,
      question: t(item.q),
      answer: <p>{t(item.a)}</p>,
    })),
  }))
  const language = languageOf(locale)
  const needsCaptcha = !principal && TURNSTILE_SITE_KEY !== undefined
  return (
    <>
      <PageHeader title={t('help.title')} description={t('help.subtitle')} />
      <FaqList sections={sections} />
      <SectionCard
        id="contact"
        title={t('help.contact.title')}
        description={t('help.contact.description')}
      >
        {sent ? (
          <Alert tone="success">
            {sent.hasEmail ? t('help.contact.sentWithEmail') : t('help.contact.sent')}
          </Alert>
        ) : (
          <ContactForm
            api={inquiryApi}
            labels={inquiryLabelsFor(language)}
            lang={language}
            context="screen:help"
            signedIn={Boolean(principal)}
            defaultEmail={principal?.email}
            captcha={
              needsCaptcha
                ? {
                    token: turnstile.token,
                    reset: turnstile.reset,
                    widget: <Turnstile siteKey={TURNSTILE_SITE_KEY} {...turnstile.widgetProps} />,
                  }
                : undefined
            }
            beforeSubmit={<p>{t('help.contact.privacy')}</p>}
            onSent={setSent}
          />
        )}
      </SectionCard>
    </>
  )
}
