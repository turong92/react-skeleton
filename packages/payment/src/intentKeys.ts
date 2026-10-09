import { newIdempotencyKey } from '@skeleton/api-client'

/**
 * 든 키의 수명 — 이 시간이 지나면 같은 입력이어도 새 키다. 서버의 결제창 유효 시간(30분)보다 짧게 둔다:
 * 한참 전 시도의 키가 오늘의 요청에 붙어 옛 주문을 돌려받는 일이 없게.
 */
export const INTENT_KEY_TTL_MS = 10 * 60_000

/**
 * 「한 번의 의도」의 `Idempotency-Key` 를 들고 있는다 — 같은 입력이면 같은 키를 다시 주고(연속 두 번 누름 · 네트워크 오류 뒤 다시 누름 ·
 * 앱이 켠 `mutations.retry`), 입력이 바뀌거나 {@link INTENT_KEY_TTL_MS} 가 지나면 새 키, 성공하면 버린다. 호출에 명시한 키가 있으면 그것이 이긴다(들고 있지 않는다).
 */
export type IntentKeys = {
  keyFor(intent: string, explicit?: string): string
  /**
   * 성공한 호출이 쓴 키를 돌려준다 — 지금 든 키가 바로 그 키일 때만 버린다
   * (그 사이 사용자가 다른 입력으로 넘어갔다면 그 입력의 키는 남아야 한다).
   */
  release(key: string): void
  /**
   * 이 키의 결과를 **모른다** — 지금 든 키가 바로 그 키라면 {@link INTENT_KEY_TTL_MS} 를 적용하지 않는다(`release` 가 올 때까지 든다).
   * 서버가 이미 그 호출로 돈을 움직였을 수 있어, 시간이 지났다고 새 키가 나가면 같은 일이 한 번 더 나갈 수 있다. 운영자 환불만 쓴다.
   */
  hold(key: string): void
  /** 든 키를 모두 놓는다 - 결과를 확인한 뒤(운영자의 「결제사와 맞추기」)에는 같은 입력도 새로 정한 새 의도라서 새 키가 나가야 한다 */
  clear(): void
}

export function createIntentKeys({
  make = newIdempotencyKey,
  now = Date.now,
  ttlMs = INTENT_KEY_TTL_MS,
}: { make?: () => string; now?: () => number; ttlMs?: number } = {}): IntentKeys {
  let held: { intent: string; key: string; since: number; unsure: boolean } | null = null
  return {
    keyFor(intent, explicit) {
      if (explicit !== undefined) return explicit
      if (held?.intent !== intent || (!held.unsure && now() - held.since >= ttlMs))
        held = { intent, key: make(), since: now(), unsure: false }
      return held.key
    },
    release(key) {
      if (held?.key === key) held = null
    },
    hold(key) {
      if (held?.key === key) held.unsure = true
    },
    clear() {
      held = null
    },
  }
}
