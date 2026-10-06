import type { TokenStorage } from './tokenStore'

export type PendingSignUp = { email: string; signUpId: string }

export type SignUpPendingStore = {
  save(pending: PendingSignUp): void
  read(): PendingSignUp | null
  clear(): void
}

/**
 * 진행 중인 가입 시도(주소 + 서버가 준 불투명한 `signUpId`)를 탭의 `sessionStorage` 에 둔다 — 코드 입력 단계에서 새로고침해도 만료(10분) 안에서는 이어진다.
 * 비밀번호는 저장하지 않는다. 저장소가 막혀 있으면 메모리.
 */
export function createSignUpPending({
  storage,
  key = 'skeleton.signUp',
  ttlMs = 10 * 60_000,
  now = Date.now,
}: {
  storage?: TokenStorage
  key?: string
  ttlMs?: number
  now?: () => number
} = {}): SignUpPendingStore {
  let memory: string | null = null
  const read = (): string | null => {
    try {
      const value = storage?.getItem(key)
      if (value !== undefined && value !== null) return value
    } catch {
      // 막혔다 — 메모리
    }
    return memory
  }
  return {
    save(pending) {
      const raw = JSON.stringify({ ...pending, at: now() })
      memory = raw
      try {
        storage?.setItem(key, raw)
      } catch {
        // 메모리에는 남았다
      }
    },
    read() {
      const raw = read()
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw) as Partial<PendingSignUp> & { at?: number }
        if (
          typeof parsed.email !== 'string' ||
          typeof parsed.signUpId !== 'string' ||
          typeof parsed.at !== 'number' ||
          now() - parsed.at > ttlMs
        )
          return null
        return { email: parsed.email, signUpId: parsed.signUpId }
      } catch {
        return null
      }
    },
    clear() {
      memory = null
      try {
        storage?.removeItem(key)
      } catch {
        // 괜찮다
      }
    },
  }
}
