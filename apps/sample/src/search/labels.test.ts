import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { searchLabelsFor } from './labels'

describe('searchLabelsFor - the header box must not share a name with the notes list filter', () => {
  it.each(['ko', 'en'] as const)(
    '%s: the box and its button do not contain the notes filter name',
    async (language) => {
      await i18n.setLocale(language, { remember: false })
      const filter = i18n.t('notes.search').toLowerCase()
      const { box } = searchLabelsFor(language)
      for (const text of [box.label, box.placeholder, box.submit])
        expect(text.toLowerCase(), text).not.toContain(filter)
      await i18n.setLocale('ko', { remember: false })
    },
  )
})
