import { AuthProvider } from '@skeleton/auth'
import { ThemedToaster } from '@skeleton/theme'
import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { createShowcaseRuntime, RuntimeContext } from './runtime'

export function ShowcaseProviders({ children }: { children: ReactNode }) {
  const [runtime] = useState(createShowcaseRuntime)
  return (
    <RuntimeContext.Provider value={runtime}>
      <QueryClientProvider client={runtime.queryClient}>
        <AuthProvider session={runtime.session}>{children}</AuthProvider>
        <ThemedToaster />
      </QueryClientProvider>
    </RuntimeContext.Provider>
  )
}
