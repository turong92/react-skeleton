/** 내려받는 파일의 이름 */
export const RECOVERY_CODES_FILE = 'recovery-codes.txt'

/** 복사 · 내려받기에 쓰는 글 - 한 줄에 하나 */
export const recoveryCodesText = (codes: readonly string[]): string => `${codes.join('\n')}\n`

/** 글을 파일로 내려받는다(서버 왕복 없이 브라우저가 만든다) - 주소는 곧 해제한다 */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
