/** 메일 캐처(mailpit)의 HTTP API 에서 받은 메일의 링크를 읽는다 — 백엔드가 비동기로 보내므로 올 때까지 기다린다 */
type Summary = { ID: string; To: Array<{ Address: string }>; Subject: string }

const LINK =
  /https?:\/\/[^\s"'<>)]+\/(verify-email|magic-link|reset-password|confirm-email-change|confirm-reauth|confirm-delete)\?token=[A-Za-z0-9_\-.~%]+/

export type MailLink = {
  kind: string
  url: string
  /** 개발 서버 주소로 바꾼 경로(`/verify-email?token=…`) */ path: string
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
