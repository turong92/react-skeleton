const normalise = (text: string) => text.trim().normalize('NFC')

/** 확인 문구를 정확히 입력했는가 — 문구가 없으면 항상 참. 앞뒤 공백은 무시, 대소문자는 구분, 한글은 조합 형태를 맞춘다 */
export function isConfirmed(phrase: string | undefined, typed: string): boolean {
  return phrase === undefined || normalise(typed) === normalise(phrase)
}
