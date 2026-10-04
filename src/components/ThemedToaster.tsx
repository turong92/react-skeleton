import { Toaster } from 'sonner'
import { useTheme } from '../lib/theme'

/** sonner 토스트도 고른 테마를 따른다(system 이면 sonner 가 OS 설정을 읽는다) */
export function ThemedToaster() {
  return <Toaster position="top-right" richColors theme={useTheme()} />
}
