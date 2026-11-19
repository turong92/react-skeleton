import type { ReactNode } from 'react'

/**
 * 프로필 사진을 고르는 자리 - 업로드는 앱 몫이다(저장 키 문자열만 오간다. 게시판의 `attachmentPicker` 와 같은 방식이라 이 패키지는 storage 패키지를 모른다).
 * `value` 는 지금 고른 키(없으면 null), 사진을 올리면 `onChange(키)`, 지우면 `onChange(null)`. 보통 storage 패키지의 `ImageUploadField` 를 `max={1}` 로 감싼다.
 * `onBusy` 는 올리는 중이면 `true`, 끝나면 `false` - 키는 올리기가 **끝난 뒤에야** `onChange` 로 오므로, 그동안 저장 단추를 막아 사진이 말없이 버려지지 않게 한다
 * (`ImageUploadField` 의 `onBusyChange` 에 그대로 넘긴다).
 */
export type ProfilePicturePicker = (args: {
  value: string | null
  onChange: (key: string | null) => void
  onBusy?: (busy: boolean) => void
}) => ReactNode
