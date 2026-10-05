export type ClipboardHost = { clipboard?: { writeText(text: string): Promise<void> } }

/** 클립보드에 글자를 쓴다. 못 쓰면(권한 · 비보안 문맥 · 없음) 던지지 않고 `false` */
export async function copyText(
  text: string,
  host: ClipboardHost = typeof navigator === 'undefined' ? {} : navigator,
): Promise<boolean> {
  try {
    if (!host.clipboard) return false
    await host.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
