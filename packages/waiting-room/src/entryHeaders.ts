/** 입장권이 필요한 요청(자리 더하기 …)에 붙이는 헤더 - 입장권이 없으면 아무것도 붙이지 않는다(서버가 `403 WAITING_ROOM.ENTRY_REQUIRED` 로 답한다) */
export function createEntryHeaders(entryToken: string | null | undefined): Record<string, string> {
  return entryToken ? { 'X-Entry-Token': entryToken } : {}
}
