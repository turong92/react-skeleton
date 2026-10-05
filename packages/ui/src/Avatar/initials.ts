/** 이름 → 아바타 글자. 라틴 글자는 앞 두 단어의 머리글자, 한글 · 한자 등은 첫 글자 하나, 없으면 `?` */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = (word: string) => Array.from(word)[0] ?? ''
  const wide = /[ᄀ-ᇿ぀-ヿ㐀-鿿가-힯]/.test(words[0])
  if (wide) return first(words[0])
  return words.slice(0, 2).map(first).join('').toUpperCase()
}

/** 이름 → 0~3 — 같은 이름은 늘 같은 색 짝(글자 · 바탕 모두 의미 토큰) */
export function toneOf(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  return hash % 4
}
