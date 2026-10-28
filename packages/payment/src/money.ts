/**
 * 통화의 소수 자릿수 — `Intl` 이 안다(KRW 0 · USD 2 · JPY 0). 모르는 통화 코드는 2.
 * 서버 금액은 통화 최소 단위 정수(원 · 센트)이고, 입력칸 · 가격표는 기본 단위(원 · 달러)다.
 */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits!
  } catch {
    return 2
  }
}

/** 최소 단위 정수 → 기본 단위(USD 1999 → 19.99, KRW 9900 → 9900) */
export function toMajorUnits(minor: number, currency: string): number {
  return minor / 10 ** currencyDigits(currency)
}

/** 기본 단위 → 최소 단위 정수(USD 19.99 → 1999). 부동소수 오차는 반올림으로 지운다 */
export function toMinorUnits(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyDigits(currency))
}
