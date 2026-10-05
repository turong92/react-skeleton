import { createContext } from 'react'
import type { I18n } from './createI18n'

export const I18nContext = createContext<I18n | null>(null)
