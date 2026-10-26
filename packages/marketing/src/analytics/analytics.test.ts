import { describe, expect, it } from 'vitest'
import { createConsentStore } from '../consent/consentStore'
import {
  CF_BEACON_URL,
  createAnalyticsLoader,
  type DocumentLike,
  type WindowLike,
} from './createAnalyticsLoader'

function fakePage() {
  const scripts: { src: string; dataset: Record<string, string> }[] = []
  const doc: DocumentLike = {
    head: { appendChild: (node) => scripts.push(node) },
    createElement: () => ({ src: '', async: false, defer: false, dataset: {} }),
  }
  const win: WindowLike = { location: { href: 'https://example.test/reset?token=SECRET&x=1' } }
  return { scripts, doc, win }
}
const memory = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}
const store = () =>
  createConsentStore({ categories: ['necessary', 'analytics'], version: '1', storage: memory() })
const gaScripts = (page: ReturnType<typeof fakePage>) =>
  page.scripts.filter((s) => s.src.includes('googletagmanager'))

describe('createAnalyticsLoader: nothing is sent before consent', () => {
  it('does not put the GA script in the page before the visitor decides or after a rejection', () => {
    const page = fakePage()
    const consent = store()
    createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-ABC123XYZ',
      document: page.doc,
      window: page.win,
    }).start()
    expect(gaScripts(page)).toEqual([])
    consent.rejectAll()
    expect(gaScripts(page)).toEqual([])
    expect(page.win.dataLayer).toBeUndefined()
  })

  it('puts the script with the measurement id in only after acceptAll()', () => {
    const page = fakePage()
    const consent = store()
    createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-ABC123XYZ',
      document: page.doc,
      window: page.win,
    }).start()
    consent.acceptAll()
    expect(gaScripts(page).map((s) => s.src)).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ',
    ])
  })

  it('loads for a returning visitor who accepted earlier, and does not load twice', () => {
    const page = fakePage()
    const consent = store()
    consent.acceptAll()
    createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-ABC123XYZ',
      document: page.doc,
      window: page.win,
    }).start()
    consent.save({ analytics: true })
    expect(gaScripts(page)).toHaveLength(1)
  })

  it('does not load without a (valid) measurement id even after consent', () => {
    const page = fakePage()
    const consent = store()
    consent.acceptAll()
    createAnalyticsLoader({ consent, document: page.doc, window: page.win }).start()
    createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-1"></script>',
      document: page.doc,
      window: page.win,
    }).start()
    expect(page.scripts).toEqual([])
  })

  it('talks to gtag.js the way it reads: every dataLayer entry is an Arguments object, never an array (an array is ignored)', () => {
    const page = fakePage()
    const consent = store()
    createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-ABC123XYZ',
      document: page.doc,
      window: page.win,
    }).start()
    consent.acceptAll()
    const entries = page.win.dataLayer as unknown[]
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
    }
    expect(typeof page.win.gtag).toBe('function')
  })

  it('denies every storage by default before anything else, then grants only analytics_storage for a visitor who accepted', () => {
    const page = fakePage()
    const consent = store()
    createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-ABC123XYZ',
      document: page.doc,
      window: page.win,
    }).start()
    consent.acceptAll()
    const commands = (page.win.dataLayer as ArrayLike<unknown>[]).map((entry) => Array.from(entry))
    expect(commands[0]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      },
    ])
    expect(commands[1]).toEqual(['consent', 'update', { analytics_storage: 'granted' }])
    expect(commands.map((c) => c[0])).toEqual([
      'consent',
      'consent',
      'js',
      'config',
      'set',
      'event',
    ])
  })

  it('sends page views with the page_location stripped of auth query values (mail-link ?token=, ?code=&state=), once per address, only while consented', () => {
    const page = fakePage()
    const consent = store()
    const loader = createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-ABC123XYZ',
      document: page.doc,
      window: page.win,
    })
    loader.start()
    loader.trackPageView()
    expect(page.win.dataLayer).toBeUndefined()
    consent.acceptAll()
    const sent = () =>
      (page.win.dataLayer as ArrayLike<unknown>[])
        .map((entry) => Array.from(entry))
        .filter((c) => c[0] === 'event')
    expect(sent()).toEqual([
      ['event', 'page_view', { page_location: 'https://example.test/reset?x=1' }],
    ])
    expect(JSON.stringify(page.win.dataLayer)).not.toContain('SECRET')
    loader.trackPageView() // 같은 주소
    page.win.location = { href: 'https://example.test/cb?code=abc&state=xyz#id_token=zzz&ok=1' }
    loader.trackPageView()
    expect(sent().map((c) => (c[2] as { page_location: string }).page_location)).toEqual([
      'https://example.test/reset?x=1',
      'https://example.test/cb#ok=1',
    ])
  })

  it('tells gtag the storage is denied when analytics is switched off afterwards, and granted again when back on', () => {
    const page = fakePage()
    const consent = store()
    createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-ABC123XYZ',
      document: page.doc,
      window: page.win,
    }).start()
    consent.acceptAll()
    consent.rejectAll()
    const last = () => Array.from((page.win.dataLayer as ArrayLike<unknown>[]).at(-1)!)
    expect(last()).toEqual(['consent', 'update', { analytics_storage: 'denied' }])
    consent.acceptAll()
    expect(last()).toEqual(['consent', 'update', { analytics_storage: 'granted' }])
    expect(gaScripts(page)).toHaveLength(1)
  })

  it('stops following the consent after the returned function is called', () => {
    const page = fakePage()
    const consent = store()
    const stop = createAnalyticsLoader({
      consent,
      gaMeasurementId: 'G-ABC123XYZ',
      document: page.doc,
      window: page.win,
    }).start()
    stop()
    consent.acceptAll()
    expect(gaScripts(page)).toEqual([])
  })
})

describe('Cloudflare beacon', () => {
  it('is cookieless: it goes in at start() with a token, once, with or without consent; no token, no beacon', () => {
    const page = fakePage()
    const consent = store()
    const loader = createAnalyticsLoader({
      consent,
      cfBeaconToken: 'abcdef0123456789',
      document: page.doc,
      window: page.win,
    })
    loader.start()
    loader.start()
    expect(page.scripts.map((s) => s.src)).toEqual([CF_BEACON_URL])
    expect(JSON.parse(page.scripts[0].dataset.cfBeacon)).toEqual({ token: 'abcdef0123456789' })
    const none = fakePage()
    createAnalyticsLoader({ consent, document: none.doc, window: none.win }).start()
    expect(none.scripts).toEqual([])
  })
})

describe('server safety', () => {
  it('start() does nothing without a document', () => {
    const consent = store()
    consent.acceptAll()
    const stop = createAnalyticsLoader({ consent, gaMeasurementId: 'G-ABC123XYZ' }).start()
    expect(typeof stop).toBe('function')
  })
})
