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
  const win: WindowLike = {}
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
    const last = () => (page.win.dataLayer as unknown[][]).at(-1)
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
