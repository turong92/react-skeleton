import { Toaster, type ToasterProps } from 'sonner'
import { useTheme } from './theme'

export type ThemedToasterProps = {
  /** 토스트 자리(기본 `top-right`). 헤더에 액션(종 · 메뉴)이 있는 앱은 `bottom-right` 로 두어 덮지 않게 한다 */
  position?: ToasterProps['position']
}

/** sonner 토스트도 고른 테마를 따른다(system 이면 sonner 가 OS 설정을 읽는다) */
export function ThemedToaster({ position = 'top-right' }: ThemedToasterProps = {}) {
  return <Toaster position={position} richColors theme={useTheme()} />
}
