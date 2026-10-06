/** 메일 캐처(mailpit)의 HTTP API 에서 받은 메일의 링크 · 6자리 인증번호를 읽는다 — 백엔드가 비동기로 보내므로 올 때까지 기다린다 */
type Summary = { ID: string; To: Array<{ Address: string }>; Subject: string }

// 링크가 남은 메일은 링크 로그인 · 비밀번호 재설정뿐이다(나머지는 6자리 인증번호)
const LINK = /https?:\/\/[^\s"'<>)]+\/(magic-link|reset-password)\?token=[A-Za-z0-9_\-.~%]+/

export type MailLink = {
  kind: string
  url: string
  /** 개발 서버 주소로 바꾼 경로(`/magic-link?token=…`) */ path: string
}

/** `to` 로 간 가장 최근 메일 중 `kind` 링크가 든 것 — `after` 이후(이미 본 메일은 건너뛴다) */
export async function waitForLink(
  mailUrl: string,
  to: string,
  kind: MailLink['kind'],
  { timeoutMs = 30_000, seen = new Set<string>() }: { timeoutMs?: number; seen?: Set<string> } = {},
): Promise<MailLink> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${mailUrl}/api/v1/messages`)).json()) as {
      messages?: Summary[]
    }
    for (const message of list.messages ?? []) {
      if (
        seen.has(message.ID) ||
        !message.To.some((t) => t.Address.toLowerCase() === to.toLowerCase())
      )
        continue
      const detail = (await (await fetch(`${mailUrl}/api/v1/message/${message.ID}`)).json()) as {
        Text?: string
        HTML?: string
      }
      const found = LINK.exec(`${detail.Text ?? ''}\n${detail.HTML ?? ''}`)
      if (found && found[1] === kind) {
        seen.add(message.ID)
        const url = found[0]
        return { kind, url, path: url.slice(new URL(url).origin.length) }
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no "${kind}" mail for ${to} within ${timeoutMs / 1000}s`)
}

/** 인증번호 메일의 종류 — 제목으로 가른다(백엔드 기본 문구: ko · en) */
export type CodeKind = 'verify' | 'email-change' | 'reauth' | 'delete'

const CODE_SUBJECT: Record<CodeKind, RegExp> = {
  verify: /^(?:인증번호|Your verification code:) (\d{6})$/,
  'email-change': /^(?:새 이메일 확인 인증번호|Your code to confirm the new email:) (\d{6})$/,
  reauth: /^(?:보안 인증번호|Your security code:) (\d{6})$/,
  delete: /^(?:계정 삭제 인증번호|Your code to delete the account:) (\d{6})$/,
}

export type MailCode = {
  code: string
  /** mailpit 의 메일 id — 화면(`/view/<id>`)으로 열어 증거를 남긴다 */
  id: string
}

/** `to` 로 간 `kind` 인증번호 메일 — 가장 최근 것부터, `seen` 에 든(이미 본) 메일은 건너뛴다 */
export async function waitForCode(
  mailUrl: string,
  to: string,
  kind: CodeKind,
  { timeoutMs = 30_000, seen = new Set<string>() }: { timeoutMs?: number; seen?: Set<string> } = {},
): Promise<MailCode> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${mailUrl}/api/v1/messages`)).json()) as {
      messages?: Summary[]
    }
    for (const message of list.messages ?? []) {
      if (
        seen.has(message.ID) ||
        !message.To.some((t) => t.Address.toLowerCase() === to.toLowerCase())
      )
        continue
      const found = CODE_SUBJECT[kind].exec(message.Subject)
      if (found) {
        seen.add(message.ID)
        return { code: found[1], id: message.ID }
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no "${kind}" code mail for ${to} within ${timeoutMs / 1000}s`)
}

/** `to` 로 간 모든 메일의 제목(가장 최근 것부터) — 「가입된 주소에는 코드가 가지 않는다」 같은 단언용 */
export async function subjectsFor(mailUrl: string, to: string): Promise<string[]> {
  const list = (await (await fetch(`${mailUrl}/api/v1/messages`)).json()) as {
    messages?: Summary[]
  }
  return (list.messages ?? [])
    .filter((m) => m.To.some((t) => t.Address.toLowerCase() === to.toLowerCase()))
    .map((m) => m.Subject)
}
