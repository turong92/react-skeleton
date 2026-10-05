import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createI18n, type Messages } from './createI18n'

const ko = {
  hello: '안녕하세요, {name}님',
  items: '{count, plural, =0 {항목 없음} other {항목 #개}}',
  'only.ko': '한국어만',
  rich: '<b>굵게</b> 그리고 보통',
}
const en: Messages = {
  hello: 'Hello, {name}',
  items: '{count, plural, =0 {No items} one {# item} other {# items}}',
  rich: '<b>Bold</b> and plain',
}
const fr: Messages = { hello: 'Bonjour, {name}' }

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
  }
}

function setup(extra: Partial<Parameters<typeof createI18n>[0]> = {}) {
  const storage = memoryStorage()
  const i18n = createI18n({
    catalogs: { ko, en },
    defaultLocale: 'ko',
    storageKey: 'test:locale',
    storage,
    languages: () => [],
    setDocumentLang: false,
    ...extra,
  } as never) as unknown as ReturnType<typeof createI18n<{ ko: typeof ko; en: Messages }, 'ko'>>
  return { i18n, storage }
}

describe('t', () => {
  it('formats ICU arguments in the current locale (the default until told otherwise)', () => {
    const { i18n } = setup()
    expect(i18n.getLocale()).toBe('ko')
    expect(i18n.t('hello', { name: '수민' })).toBe('안녕하세요, 수민님')
    expect(i18n.t('items', { count: 0 })).toBe('항목 없음')
    expect(i18n.t('items', { count: 3 })).toBe('항목 3개')
  })

  it('uses the plural rules of the locale (English one/other)', async () => {
    const { i18n } = setup()
    await i18n.setLocale('en')
    expect(i18n.t('items', { count: 1 })).toBe('1 item')
    expect(i18n.t('items', { count: 2 })).toBe('2 items')
    expect(i18n.t('items', { count: 1234 })).toBe('1,234 items')
  })

  it('a key missing from the current locale shows the default-locale message instead of the key', async () => {
    const { i18n } = setup()
    await i18n.setLocale('en')
    expect(i18n.t('only.ko')).toBe('한국어만')
  })

  it('a key missing everywhere returns the key and reports it once per locale+key', () => {
    const onMissingKey = vi.fn()
    const { i18n } = setup({ onMissingKey })
    expect(i18n.t('nope' as never)).toBe('nope')
    expect(i18n.t('nope' as never)).toBe('nope')
    expect(onMissingKey).toHaveBeenCalledTimes(1)
    expect(onMissingKey).toHaveBeenCalledWith({ locale: 'ko', key: 'nope' })
  })

  it('tIn formats in a given locale without switching the current one', async () => {
    const { i18n } = setup()
    await i18n.preload('en')
    expect(i18n.tIn('en', 'hello', { name: 'Ada' })).toBe('Hello, Ada')
    expect(i18n.getLocale()).toBe('ko')
  })

  it('tIn on a locale that is not loaded yet falls back to the default message', () => {
    const { i18n } = setup({
      catalogs: { ko, en: async () => en },
    })
    expect(i18n.tIn('en', 'hello', { name: 'Ada' })).toBe('안녕하세요, Ada님')
  })
})

describe('format errors', () => {
  it('a missing argument returns the key and reports it instead of crashing the screen', () => {
    const onError = vi.fn()
    const { i18n } = setup({ onError })
    expect(i18n.t('hello')).toBe('hello')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toMatchObject({ locale: 'ko', key: 'hello' })
  })
})

describe('tRich', () => {
  it('turns tags into elements through the given functions, in the translated word order', async () => {
    const { i18n } = setup()
    const html = () =>
      renderToStaticMarkup(
        <p>{i18n.tRich('rich', { b: (chunks) => <strong>{chunks}</strong> })}</p>,
      )
    expect(html()).toBe('<p><strong>굵게</strong> 그리고 보통</p>')
    await i18n.setLocale('en')
    expect(html()).toBe('<p><strong>Bold</strong> and plain</p>')
  })

  it('also fills plain arguments', () => {
    const { i18n } = setup()
    expect(renderToStaticMarkup(<p>{i18n.tRich('hello', { name: 'Ada' })}</p>)).toBe(
      '<p>안녕하세요, Ada님</p>',
    )
  })
})

describe('setLocale', () => {
  it('switches, notifies subscribers once, remembers the choice and sets the document language', async () => {
    const root = { lang: '' }
    const { i18n, storage } = setup({ setDocumentLang: true, documentElement: () => root })
    const listener = vi.fn()
    i18n.subscribe(listener)
    await i18n.setLocale('en')
    expect(i18n.getLocale()).toBe('en')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(storage.data['test:locale']).toBe('en')
    expect(root.lang).toBe('en')
  })

  it('setting the same locale again notifies nobody', async () => {
    const { i18n } = setup()
    const listener = vi.fn()
    i18n.subscribe(listener)
    await i18n.setLocale('ko')
    expect(listener).not.toHaveBeenCalled()
  })

  it('remember: false switches without writing the storage', async () => {
    const { i18n, storage } = setup()
    await i18n.setLocale('en', { remember: false })
    expect(i18n.getLocale()).toBe('en')
    expect(storage.data).toEqual({})
  })

  it('unsubscribe stops notifications', async () => {
    const { i18n } = setup()
    const listener = vi.fn()
    const off = i18n.subscribe(listener)
    off()
    await i18n.setLocale('en')
    expect(listener).not.toHaveBeenCalled()
  })

  it('a locale that is not configured is rejected and nothing changes', async () => {
    const { i18n } = setup()
    await expect(i18n.setLocale('xx' as never)).rejects.toThrow(RangeError)
    expect(i18n.getLocale()).toBe('ko')
  })

  it('a storage that throws (private window) does not stop the switch', async () => {
    const { i18n } = setup({
      storage: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
      },
    })
    await i18n.setLocale('en')
    expect(i18n.getLocale()).toBe('en')
  })
})

describe('lazy catalogs', () => {
  it('loads a catalog function on demand and switches only after it arrived', async () => {
    let resolve!: (messages: Messages) => void
    const loader = vi.fn(() => new Promise<Messages>((r) => (resolve = r)))
    const { i18n } = setup({ catalogs: { ko, en: loader } })
    expect(loader).not.toHaveBeenCalled()
    expect(i18n.isLoaded('en')).toBe(false)
    const switching = i18n.setLocale('en')
    expect(i18n.getLocale()).toBe('ko')
    resolve(en)
    await switching
    expect(i18n.getLocale()).toBe('en')
    expect(i18n.isLoaded('en')).toBe(true)
    expect(i18n.t('hello', { name: 'Ada' })).toBe('Hello, Ada')
  })

  it('accepts a dynamic import module shape ({ default })', async () => {
    const { i18n } = setup({ catalogs: { ko, en: async () => ({ default: en }) } })
    await i18n.setLocale('en')
    expect(i18n.t('hello', { name: 'Ada' })).toBe('Hello, Ada')
  })

  it('loads once even when asked twice at the same time', async () => {
    const loader = vi.fn(async () => en)
    const { i18n } = setup({ catalogs: { ko, en: loader } })
    await Promise.all([i18n.preload('en'), i18n.setLocale('en')])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('a failed load rejects, keeps the current locale and can be retried', async () => {
    const loader = vi
      .fn<() => Promise<Messages>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(en)
    const { i18n } = setup({ catalogs: { ko, en: loader } })
    await expect(i18n.setLocale('en')).rejects.toThrow('network')
    expect(i18n.getLocale()).toBe('ko')
    await i18n.setLocale('en')
    expect(i18n.getLocale()).toBe('en')
  })

  it('the default locale must be an object (the fallback cannot arrive late)', () => {
    expect(() =>
      createI18n({ catalogs: { ko: async () => ko, en }, defaultLocale: 'ko', storageKey: 'k' }),
    ).toThrow(/default locale/i)
  })

  it('a switching race resolves to the latest request', async () => {
    let resolveFr!: (m: Messages) => void
    const { i18n } = setup({
      catalogs: { ko, en, fr: () => new Promise<Messages>((r) => (resolveFr = r)) },
    })
    const toFr = i18n.setLocale('fr' as never)
    await i18n.setLocale('en')
    resolveFr(fr)
    await toFr
    expect(i18n.getLocale()).toBe('en')
  })
})

describe('init (detection)', () => {
  it('stored choice → browser language → default', async () => {
    const a = setup({ storage: memoryStorage({ 'test:locale': 'en' }), languages: () => ['ko'] })
    expect(await a.i18n.init()).toBe('en')
    const b = setup({ languages: () => ['en-US'] })
    expect(await b.i18n.init()).toBe('en')
    const c = setup({ languages: () => ['de'] })
    expect(await c.i18n.init()).toBe('ko')
  })

  it('does not write the detected locale (only an explicit choice is remembered)', async () => {
    const { i18n, storage } = setup({ languages: () => ['en'] })
    await i18n.init()
    expect(storage.data).toEqual({})
  })

  it('loads a lazy catalog for the detected locale before reporting it', async () => {
    const loader = vi.fn(async () => en)
    const { i18n } = setup({ catalogs: { ko, en: loader }, languages: () => ['en'] })
    await i18n.init()
    expect(loader).toHaveBeenCalledTimes(1)
    expect(i18n.t('hello', { name: 'Ada' })).toBe('Hello, Ada')
  })
})

describe('server safety', () => {
  it('creating the instance and formatting touches no storage, navigator or document', () => {
    const getItem = vi.fn()
    const languages = vi.fn(() => [])
    const { i18n } = setup({ storage: { getItem, setItem: vi.fn() }, languages })
    i18n.t('hello', { name: 'x' })
    i18n.getLocale()
    expect(getItem).not.toHaveBeenCalled()
    expect(languages).not.toHaveBeenCalled()
  })

  it('works with no window at all when storage and languages are not injected', async () => {
    const i18n = createI18n({ catalogs: { ko, en }, defaultLocale: 'ko', storageKey: 'k' })
    expect(i18n.t('hello', { name: 'x' })).toBe('안녕하세요, x님')
    await i18n.setLocale('en') // storage 없음 · document 없음 — 던지지 않는다
    expect(i18n.getLocale()).toBe('en')
  })
})

describe('types', () => {
  it('keys come from the default catalog (a typo is a compile error, checked by pnpm typecheck)', () => {
    const typed = createI18n({
      catalogs: { ko, en },
      defaultLocale: 'ko',
      storageKey: 'k',
      storage: null,
    })
    expect(typed.t('hello', { name: 'x' })).toBe('안녕하세요, x님')
    // @ts-expect-error — 'nope' is not a key of the default catalog
    typed.t('nope')
    // @ts-expect-error — 'fr' is not a configured locale
    void typed.setLocale('fr').catch(() => undefined)
  })
})

describe('localeName', () => {
  it('is the language written in itself, whatever the current locale is', () => {
    const { i18n } = setup()
    expect(i18n.localeName('ko')).toBe('한국어')
    expect(i18n.localeName('en')).toBe('English')
  })
})
