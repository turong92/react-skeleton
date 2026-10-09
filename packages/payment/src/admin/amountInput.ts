/** 통화의 소수 자릿수(`Intl` 이 안다 — KRW 0 · USD 2). 모르는 통화 코드는 0 */
export function fractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 0
    )
  } catch {
    return 0
  }
}

/** 최소 단위 정수를 사람이 적는 모양으로(`2999`, 2자리 → `29.99`) */
export function minorToInput(minor: number, digits: number): string {
  if (digits === 0) return String(minor)
  const scale = 10 ** digits
  const whole = Math.floor(minor / scale)
  const fraction = String(minor % scale).padStart(digits, '0')
  return `${whole}.${fraction}`
}

export type ParsedAmount = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ok'; minor: number }

/**
 * 적은 글자 → 최소 단위 정수. 부동소수점을 거치지 않는다(`29.99` 가 `2998.99…` 가 되지 않게 글자를 잘라 읽는다).
 * 천 단위 쉼표와 앞뒤 공백은 받는다. 부호 · 지수 · 통화의 자릿수보다 긴 소수 · 정확히 다룰 수 없게 큰 수는 `invalid`.
 */
export function parseAmountInput(text: string, digits: number): ParsedAmount {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  const plain = trimmed.replace(/,/g, '')
  const match = /^(\d+)(?:\.(\d+))?$/.exec(plain)
  if (!match || (trimmed.includes(',') && !/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(trimmed)))
    return { kind: 'invalid' }
  const fraction = match[2] ?? ''
  if (fraction.length > digits) return { kind: 'invalid' }
  const minor = Number(match[1] + fraction.padEnd(digits, '0'))
  return Number.isSafeInteger(minor) ? { kind: 'ok', minor } : { kind: 'invalid' }
}
