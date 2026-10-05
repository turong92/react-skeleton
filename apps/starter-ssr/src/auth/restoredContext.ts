import { createContext } from 'react'
import type { Auth } from './createAuth'

export const AuthRestoredContext = createContext<Auth | null>(null)
