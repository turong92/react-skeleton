/** `Idempotency-Key` 헤더용 키. 같은 작업을 재시도할 때만 재사용하고, 새 작업마다 새로 만든다 */
export function newIdempotencyKey(): string {
  return `fe-${crypto.randomUUID()}`
}
