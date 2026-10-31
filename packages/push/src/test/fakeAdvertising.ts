import type { ConsentRequest, ConsentSource, LegalApi, LegalDocument } from '@skeleton/legal'
import type { PushApi } from '../pushApi'
import type { AdvertisingConsent, PushAdvertising } from '../types'
import { advertisingFixture } from '../advertising/fixture'

const AT = '2026-10-31T00:00:00Z'
const EXPIRES = '2028-10-30T00:00:00Z'

type Seed = Parameters<typeof advertisingFixture>[0]

/** 서버처럼 상태를 계산하는 가짜 — 광고를 철회하면 야간은 효력이 없고, 동의 · 철회는 `legal` 호출로만 바뀐다. 부른 것은 `agreed` / `withdrawn` 에 남는다 */
export function fakeAdvertising(seed: Seed = {}, options: { failRead?: boolean } = {}) {
  let ad: PushAdvertising = advertisingFixture(seed)
  let failRead = options.failRead ?? false
  const agreed: { consents: ConsentRequest[]; source: ConsentSource | undefined }[] = []
  const withdrawn: string[] = []

  const recompute = () => {
    ad = {
      ...ad,
      night: { ...ad.night, effective: ad.night.state === 'AGREED' && ad.consent.effective },
    }
  }
  const set = (type: string, patch: Partial<AdvertisingConsent>) => {
    ad =
      type === ad.consent.type
        ? { ...ad, consent: { ...ad.consent, ...patch } }
        : { ...ad, night: { ...ad.night, ...patch } }
    recompute()
  }

  const push = {
    getAdvertising: async () => {
      if (failRead) throw new Error('server down')
      return structuredClone(ad)
    },
  } as unknown as PushApi

  const legalDocument = (type: string): LegalDocument => ({
    type,
    version: 'v3',
    locale: 'ko',
    effectiveFrom: '2026-01-01T00:00:00Z',
    current: true,
    template: false,
    title: type === 'marketing' ? '광고성 정보 수신 동의' : '야간 광고성 정보 수신 동의',
    sha256: 'x',
    required: false,
    requiredAtSignUp: false,
    markdown: `## ${type}\n\n이벤트와 혜택 소식을 푸시 알림으로 보내 드려요.`,
  })

  const legal = {
    documents: async () => [],
    document: async (type: string) => legalDocument(type),
    myConsents: async () => ({ blocked: false, items: [], missing: [] }),
    agree: async (consents: ConsentRequest[], source?: ConsentSource) => {
      agreed.push({ consents, source })
      for (const c of consents)
        set(c.type, {
          state: 'AGREED',
          agreedAt: AT,
          expiresAt: EXPIRES,
          reconfirmDue: false,
          effective: true,
        })
      return { blocked: false, items: [], missing: [] }
    },
    withdraw: async (type: string) => {
      withdrawn.push(type)
      set(type, {
        state: 'WITHDRAWN',
        agreedAt: null,
        expiresAt: null,
        reconfirmDue: false,
        effective: false,
      })
      return { blocked: false, items: [], missing: [] }
    },
    history: async () => {
      throw new Error('not used')
    },
  } as unknown as LegalApi

  return {
    push,
    legal,
    agreed,
    withdrawn,
    /** 이후 읽기를 실패시킨다(서버가 죽은 상황) */
    breakRead: () => void (failRead = true),
  }
}
