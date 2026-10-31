import type { ConsentRequest, ConsentSource } from '@skeleton/legal'
import type { AdvertisingConsent, PushAdvertising } from '../types'

export type ConsentKind = 'consent' | 'night'

/** 광고 동의 없이 야간 동의를 받으려 했다 — 화면이 잠그지만 호출 자체도 막는다 */
export class AdvertisingBlockedError extends Error {
  constructor() {
    super('Night consent requires an effective advertising consent')
    this.name = 'AdvertisingBlockedError'
  }
}

/**
 * 켜진 것으로 보여도 되는가 — 서버가 「보낼 수 있다」(`effective`)고 했고 상태도 `AGREED` 일 때만.
 * 야간은 광고 동의도 켜져 있어야 한다(광고를 철회하면 서버에 남은 야간 동의는 효력이 없다).
 */
export function isOn(ad: PushAdvertising, kind: ConsentKind): boolean {
  const on = (c: AdvertisingConsent) => c.state === 'AGREED' && c.effective
  return kind === 'consent' ? on(ad.consent) : on(ad.night) && on(ad.consent)
}

/** 만료됐거나 만료가 가까워 다시 확인받아야 한다 */
export function needsReconfirm(c: AdvertisingConsent): boolean {
  return c.state === 'EXPIRED' || c.reconfirmDue
}

/**
 * `POST /legal/consents` 본문 — 사용자가 **읽은** 판(`doc`)에 동의한다. 재확인이면 `source: 'reconfirm'`(2년이 새로 시작),
 * 아니면 `push-settings`. 광고 동의가 없으면 야간 동의는 만들지 않는다.
 */
export function agreementRequest(
  ad: PushAdvertising,
  kind: ConsentKind,
  doc: { version: string; locale: string },
): { consents: ConsentRequest[]; source: ConsentSource } {
  if (kind === 'night' && !isOn(ad, 'consent')) throw new AdvertisingBlockedError()
  const target = kind === 'consent' ? ad.consent : ad.night
  return {
    consents: [{ type: target.type, version: doc.version, locale: doc.locale }],
    source: needsReconfirm(target) ? 'reconfirm' : 'push-settings',
  }
}

/** 만료까지 남은 날(올림, 0 미만 없음) */
export function daysLeft(expiresAt: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - nowMs) / 86_400_000))
}

/**
 * 철회 — 광고 수신을 철회하면 야간 동의가 남아 있을 때 그것도 철회한다(광고에 다시 동의했을 때 야간이 말없이 되살아나지 않게).
 * 광고 → 야간 순서이고, 야간만 철회하면 광고 동의는 그대로다.
 */
export async function withdrawAdvertising(
  legal: { withdraw(type: string): Promise<unknown> },
  ad: PushAdvertising,
  kind: ConsentKind,
): Promise<void> {
  if (kind === 'night') {
    await legal.withdraw(ad.night.type)
    return
  }
  await legal.withdraw(ad.consent.type)
  if (ad.night.state === 'AGREED') await legal.withdraw(ad.night.type)
}
