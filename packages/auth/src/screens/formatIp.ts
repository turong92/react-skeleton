/** `"1.2.3.4"` → 네 숫자, 아니면 null */
function ipv4Parts(text: string): number[] | null {
  const parts = text.split('.')
  if (parts.length !== 4) return null
  const numbers = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN))
  return numbers.every((n) => n >= 0 && n <= 255) ? numbers : null
}

/** IPv6 문자열 → 16비트 묶음 8개(압축 `::` · 끝의 IPv4 꼴 모두), 아니면 null */
function ipv6Groups(text: string): number[] | null {
  let value = text.toLowerCase()
  const tail = value.match(/:(\d+\.\d+\.\d+\.\d+)$/)
  if (tail) {
    const v4 = ipv4Parts(tail[1])
    if (!v4) return null
    value = `${value.slice(0, -tail[1].length)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  }
  const halves = value.split('::')
  if (halves.length > 2) return null
  const read = (part: string) => (part === '' ? [] : part.split(':'))
  const head = read(halves[0])
  const rest = halves.length === 2 ? read(halves[1]) : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest]
  const numbers = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN))
  return numbers.length === 8 && numbers.every((n) => !Number.isNaN(n)) ? numbers : null
}

/** 가장 긴 0 묶음(2개 이상)을 `::` 로 줄인 표기 */
function compress(groups: number[]): string {
  let best = { start: -1, length: 0 }
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) {
      i += 1
      continue
    }
    let j = i
    while (j < 8 && groups[j] === 0) j += 1
    if (j - i > best.length) best = { start: i, length: j - i }
    i = j
  }
  const hex = groups.map((g) => g.toString(16))
  if (best.length < 2) return hex.join(':')
  return `${hex.slice(0, best.start).join(':')}::${hex.slice(best.start + best.length).join(':')}`
}

/**
 * 기기 목록에 보일 IP — 루프백(`127.x` · `::1` · 전개형 `0:0:0:0:0:0:0:1` · `::ffff:127.0.0.1`)은 「이 기기(로컬)」(`localLabel`),
 * 그 밖의 IPv6 는 압축 표기, IPv4 와 알 수 없는 글자는 그대로, `null` 은 `null`.
 */
export function formatIp(ip: string | null, localLabel: string): string | null {
  if (ip === null) return null
  const v4 = ipv4Parts(ip)
  if (v4) return v4[0] === 127 ? localLabel : ip
  if (!ip.includes(':')) return ip
  const groups = ipv6Groups(ip)
  if (!groups) return ip
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return localLabel
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const [a, b, c, d] = [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255]
    return a === 127 ? localLabel : `${a}.${b}.${c}.${d}`
  }
  return compress(groups)
}
