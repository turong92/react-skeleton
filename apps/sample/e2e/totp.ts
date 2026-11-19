import { createHmac } from 'node:crypto'

/*
 * 시험용 인증 앱 - RFC 6238(SHA1 · 6자리 · 30초). 화면이 보여 준 base32 비밀로 코드를 계산한다(Node `crypto`만).
 */

export const STEP_MS = 30_000
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** 이 시각이 속한 걸음 번호 */
export const stepOf = (ms: number) => Math.floor(ms / STEP_MS)

function base32(secret: string): Buffer {
  let bits = ''
  for (const char of secret.replace(/[\s=-]/g, '').toUpperCase()) {
    const value = ALPHABET.indexOf(char)
    if (value < 0) throw new Error(`not base32: ${char}`)
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes = bits.match(/.{8}/g) ?? []
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)))
}

/**
 * 다음에 쓸 걸음 - 지금 걸음과 마지막으로 쓴 걸음 + 1 중 큰 쪽(서버는 같은 걸음의 코드를 두 번 받지 않는다). 서버는 한 걸음 앞까지만 받으므로(±1) 두 걸음 이상 앞이면 `waitMs` 만큼 기다려야 한다
 */
export function nextStep(lastStep: number, nowMs: number): { step: number; waitMs: number } {
  const step = Math.max(stepOf(nowMs), lastStep + 1)
  return { step, waitMs: Math.max(0, (step - 1) * STEP_MS - nowMs) }
}

/** 이 걸음의 6자리 코드 */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', base32(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 1_000_000).padStart(6, '0')
}

/** 사용자 한 명의 인증 앱 - 코드를 낼 때마다 걸음이 앞으로만 간다(`nextStep`). `last` 는 마지막으로 쓴 걸음 */
export function createAuthenticatorApp(secret: string, initialLast = -1) {
  let last = initialLast
  return {
    secret,
    get last() {
      return last
    },
    async code(): Promise<string> {
      const { step, waitMs } = nextStep(last, Date.now())
      last = step
      if (waitMs > 0) await new Promise((done) => setTimeout(done, waitMs + 250))
      return totpAt(secret, step)
    },
  }
}
