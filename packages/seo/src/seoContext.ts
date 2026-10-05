import { createContext } from 'react'
import type { SeoDefaults } from './headSpec'

export const SeoContext = createContext<SeoDefaults | null>(null)
