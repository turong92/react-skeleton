import type { PushStorage } from './storage'

export const INSTALLATION_ID_KEY = 'skeleton.push.installation-id'
/** 서버가 받는 모양(`[A-Za-z0-9_-]{16,64}`) */
const VALID = /^[A-Za-z0-9_-]{16,64}$/

let memory: string | null = null

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * 이 브라우저(설치)의 기기 id — 무작위 값을 저장소에 한 번 만들어 두고 계속 쓴다. 서버에서 한 설치 = 한 줄이다.
 * 저장소가 막혀 있으면 이 페이지가 열려 있는 동안만 같은 값을 쓴다.
 */
export function getInstallationId(storage: PushStorage): string {
  try {
    const stored = storage.getItem(INSTALLATION_ID_KEY)
    if (stored && VALID.test(stored)) return stored
  } catch {
    // 저장소가 막혔다 — 아래에서 메모리 값을 쓴다
  }
  const fresh = memory ?? randomId()
  memory = fresh
  try {
    storage.setItem(INSTALLATION_ID_KEY, fresh)
  } catch {
    // 같은 페이지 안에서만 유지된다
  }
  return fresh
}
