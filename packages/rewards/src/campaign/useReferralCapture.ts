import { ApiRequestError } from '@skeleton/api-client'
import { useEffect, useRef, useState } from 'react'

/** `localStorage` 꼴 — 앱이 넣는다(패키지는 import 때 브라우저 전역을 읽지 않는다) */
export type ReferralStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type ReferralCaptureOptions = {
  storage: ReferralStorage
  /** URL 쿼리 이름(기본 `ref`) */
  param?: string
  /** 보관 일수(기본 30) */
  ttlDays?: number
  /** 저장소 키(기본 `skeleton.referral`) */
  storageKey?: string
  now?: () => number
}

export type ReferralCapture = {
  /** `?ref=코드` 가 있으면 보관하고 true. 코드 꼴이 아니면 무시(이미 보관한 것은 그대로) */
  captureFrom(search: string): boolean
  /** 보관 중인 코드(30일이 지났으면 지우고 null) */
  pending(): string | null
  clear(): void
}

const CODE = /^[A-Za-z0-9]{4,32}$/
const DAY_MS = 24 * 60 * 60 * 1000

export function createReferralCapture({
  storage,
  param = 'ref',
  ttlDays = 30,
  storageKey = 'skeleton.referral',
  now = Date.now,
}: ReferralCaptureOptions): ReferralCapture {
  const clear = () => {
    try {
      storage.removeItem(storageKey)
    } catch {
      // 저장소를 못 쓰면 보관도 못 했다
    }
  }
  return {
    captureFrom(search) {
      const code = new URLSearchParams(search).get(param)?.trim()
      if (!code || !CODE.test(code)) return false
      try {
        storage.setItem(storageKey, JSON.stringify({ code, savedAt: now() }))
        return true
      } catch {
        return false
      }
    },
    pending() {
      try {
        const raw = storage.getItem(storageKey)
        if (!raw) return null
        const saved = JSON.parse(raw) as { code?: unknown; savedAt?: unknown }
        if (
          typeof saved.code !== 'string' ||
          typeof saved.savedAt !== 'number' ||
          now() - saved.savedAt > ttlDays * DAY_MS
        ) {
          clear()
          return null
        }
        return saved.code
      } catch {
        return null
      }
    },
    clear,
  }
}

/**
 * 보관 중인 코드를 한 번 claim 한다. 서버가 답했으면(성공 · 400 · 409 …) 맞든 틀리든 코드를 지운다 —
 * 같은 코드로 다시 부르지 않는다. 서버에 닿지 못했으면(네트워크 · 5xx) 다음 기회를 위해 남긴다.
 */
export async function claimPendingReferral({
  capture,
  claim,
  onClaimed,
  onRejected,
}: {
  capture: ReferralCapture
  claim: (code: string) => Promise<void>
  onClaimed?: () => void
  onRejected?: (error: ApiRequestError) => void
}): Promise<void> {
  const code = capture.pending()
  if (!code) return
  try {
    await claim(code)
    capture.clear()
    onClaimed?.()
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      error.apiError.status >= 400 &&
      error.apiError.status < 500
    ) {
      capture.clear()
      onRejected?.(error)
    }
  }
}

export type UseReferralCaptureOptions = ReferralCaptureOptions & {
  claim: (code: string) => Promise<void>
  /** 로그인했는지 — 로그인한 뒤에야 claim 한다 */
  signedIn: boolean
  /** 주소의 쿼리(기본 `window.location.search`, 브라우저에서만 읽는다) */
  search?: string
  onClaimed?: () => void
  onRejected?: (error: ApiRequestError) => void
}

/**
 * 초대 링크(`?ref=코드`)를 보관했다가 로그인한 뒤 한 번 claim 한다. 앱 루트 근처에서 한 번 부른다.
 * 보관은 처음 그릴 때 한 번, claim 은 `signedIn` 이 참이 되면 한 번.
 */
export function useReferralCapture(options: UseReferralCaptureOptions): void {
  const { signedIn, search, claim, onClaimed, onRejected } = options
  const [capture] = useState(() => createReferralCapture(options))
  const latest = useRef({ claim, onClaimed, onRejected })
  const busy = useRef(false)

  useEffect(() => {
    latest.current = { claim, onClaimed, onRejected }
  })

  useEffect(() => {
    capture.captureFrom(search ?? window.location.search)
  }, [capture, search])

  useEffect(() => {
    if (!signedIn || busy.current) return
    busy.current = true
    void claimPendingReferral({
      capture,
      claim: (code) => latest.current.claim(code),
      onClaimed: () => latest.current.onClaimed?.(),
      onRejected: (error) => latest.current.onRejected?.(error),
    }).finally(() => {
      busy.current = false
    })
  }, [capture, signedIn])
}
