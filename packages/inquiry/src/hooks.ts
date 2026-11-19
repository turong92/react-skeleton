import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { inquiryProblem, type InquiryProblem } from './errors'
import type { InquiryApi } from './inquiryApi'
import type { InquiryKind } from './types'
import { inquiryFieldProblems } from './validation'

/** 사람 확인 위젯 한 벌 — `@skeleton/captcha-turnstile` 의 `useTurnstileToken()` 결과(`token` · `reset`)에 위젯 요소(`widget`)를 얹어 앱이 만든다 */
export type InquiryCaptcha = {
  token: string | null
  /** 보내기가 실패하면 부른다 — 토큰은 한 번만 쓰인다 */
  reset: () => void
  widget: ReactNode
}

export type UseInquiryFormOptions = {
  /** 화면 언어 — 서버가 답장 언어를 가리는 데 쓴다 */
  lang?: string
  /** 앱이 붙이는 선택 문자열(≤100자) */
  context?: string
  /** 로그인한 사람의 확인된 이메일(늦게 올 수 있다) — 사용자가 손대기 전까지만 채운다 */
  defaultEmail?: string | null
  /** 로그인하지 않았고 서버에 사람 확인이 켜져 있을 때만 준다 — 있으면 토큰이 있어야 보낸다 */
  captcha?: Pick<InquiryCaptcha, 'token' | 'reset'>
  /** 보낸 뒤 — 답장 받을 이메일을 적었는지 알려 준다(「잘 받았어요」 문구가 갈린다) */
  onSent?: (info: { hasEmail: boolean }) => void
}

/** 문의 폼의 상태 · 검증 · 전송 — 문구를 모른다(오류는 갈래만 돌려준다). 틀린 곳은 한 번 보내 보려 한 뒤부터 알려 준다 */
export function useInquiryForm(
  api: Pick<InquiryApi, 'send'>,
  { lang, context, defaultEmail, captcha, onSent }: UseInquiryFormOptions = {},
) {
  const [kind, setKind] = useState<InquiryKind>('QUESTION')
  const [body, setBody] = useState('')
  const [typedEmail, setTypedEmail] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)

  const email = typedEmail ?? defaultEmail ?? ''
  const found = inquiryFieldProblems({ body, email })
  const captchaMissing = captcha !== undefined && captcha.token === null

  const send = useMutation({
    mutationFn: () =>
      api.send({ kind, body, lang, replyEmail: email, context, captchaToken: captcha?.token }),
    onSuccess: () => {
      setBody('')
      setAttempted(false)
      onSent?.({ hasEmail: email.trim() !== '' })
    },
    onError: () => captcha?.reset(),
  })

  const problem: InquiryProblem | null = send.isError ? inquiryProblem(send.error) : null

  return {
    kind,
    setKind,
    body,
    setBody,
    email,
    setEmail: setTypedEmail,
    /** 보내 보려 한 뒤의 틀린 칸 */
    problems: attempted ? found : {},
    captchaMissing: attempted && captchaMissing,
    pending: send.isPending,
    problem,
    error: send.error,
    submit: () => {
      setAttempted(true)
      if (Object.keys(found).length > 0 || captchaMissing || send.isPending) return
      send.mutate()
    },
  }
}
