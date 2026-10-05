/**
 * 요청 내용마다 `Idempotency-Key` 하나. 같은 내용을 다시 보낼 때(더블클릭 · 시간 초과 뒤 재시도)는 같은 키 — 서버가 첫 응답을 재생해 노트가 둘 생기지 않는다.
 * 내용이 바뀌면 새 키 — 서버는 같은 키에 다른 본문이 오면 409 를 돌려주므로, 400 을 고쳐 다시 보낼 때 이전 키를 쓰면 안 된다.
 */
export function createKeyRing(newKey: () => string) {
  let last: { fingerprint: string; key: string } | null = null
  return (content: unknown): string => {
    const fingerprint = JSON.stringify(content)
    if (last?.fingerprint !== fingerprint) last = { fingerprint, key: newKey() }
    return last.key
  }
}
