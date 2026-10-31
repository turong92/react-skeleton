import type { AdvertisingConsent, PushAdvertising } from '../types'

type Override = {
  consent?: Partial<AdvertisingConsent>
  night?: Partial<AdvertisingConsent>
  senderName?: string
}

/** 시험 · 스토리용 `GET /push/advertising` 본문 — 기본은 아무것도 동의하지 않은 상태 */
export function advertisingFixture(over: Override = {}): PushAdvertising {
  return {
    advertisingTypes: ['promo.notes-tips'],
    senderName: over.senderName ?? 'Example Co.',
    consent: {
      type: 'marketing',
      state: 'NONE',
      agreedAt: null,
      expiresAt: null,
      reconfirmDue: false,
      effective: false,
      ...over.consent,
    },
    night: {
      type: 'marketing-night',
      state: 'NONE',
      agreedAt: null,
      expiresAt: null,
      reconfirmDue: false,
      effective: false,
      ...over.night,
    },
    nightWindow: { start: '21:00', end: '08:00', zone: 'Asia/Seoul' },
  }
}
