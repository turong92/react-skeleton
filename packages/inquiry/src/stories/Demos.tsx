import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { ContactForm } from '../ContactForm'
import { FaqList } from '../FaqList'
import { koInquiryLabels } from '../labels'
import { createFakeInquiry, type FakeInquiryOptions } from './fakeInquiry'
import { WithQuery } from './WithQuery'

/*
 * 스토리용 화면 — 가짜 서버를 스토리를 열 때 한 번만 만들고, 앱이 하는 일(「보냈어요」 화면 · 이동)은 「앱이 한 일」 줄(`role="status"`)에 적어 play 가 읽는다.
 */
function Log({ lines }: { lines: string[] }) {
  return (
    <p role="status" aria-label="log">
      {lines.join(' | ')}
    </p>
  )
}

export function ContactDemo({
  signedIn,
  failWith,
  withCaptcha,
}: FakeInquiryOptions & { signedIn?: boolean; withCaptcha?: boolean }) {
  const [{ api, sent }] = useState(() => createFakeInquiry({ failWith }))
  const [lines, setLines] = useState<string[]>([])
  const [token, setToken] = useState<string | null>(null)
  const captcha = withCaptcha
    ? {
        token,
        reset: () => {
          setToken(null)
          setLines((l) => [...l, 'captcha-reset'])
        },
        widget: (
          <Button variant="secondary" onClick={() => setToken('tok')}>
            사람입니다
          </Button>
        ),
      }
    : undefined
  return (
    <WithQuery>
      <ContactForm
        api={api}
        labels={koInquiryLabels}
        lang="ko"
        context="screen:help"
        signedIn={signedIn}
        defaultEmail={signedIn ? 'user@example.com' : undefined}
        captcha={captcha}
        onSent={({ hasEmail }) =>
          setLines((l) => [
            ...l,
            `sent:${sent.at(-1)?.kind}:${hasEmail ? 'reply' : 'no-reply'}:${sent.at(-1)?.captchaToken ?? '-'}`,
          ])
        }
      />
      <Log lines={lines} />
    </WithQuery>
  )
}

export function FaqDemo() {
  return (
    <FaqList
      sections={[
        {
          id: 'start',
          title: '시작하기',
          items: [
            {
              id: 'begin',
              question: '어떻게 시작하나요?',
              answer: <p>앱을 열고 로그인하면 돼요.</p>,
            },
            { id: 'free', question: '무료인가요?', answer: <p>기본 기능은 무료예요.</p> },
          ],
        },
        {
          id: 'account',
          title: '계정',
          items: [
            { id: 'leave', question: '탈퇴하려면요?', answer: <p>설정에서 탈퇴할 수 있어요.</p> },
          ],
        },
      ]}
    />
  )
}
