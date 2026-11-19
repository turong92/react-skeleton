import type { ProfilePicturePicker } from '@skeleton/auth'
import { PicturePicker } from '../board/Pictures'

/**
 * 프로필 사진 고르기 칸 - 계정 설정(`settings.profilePicture`)과 닉네임 관리(`picturePicker`)가 같이 쓴다. 한 장짜리 `ImageUploadField`(`max={1}`)이고
 * 파일은 브라우저가 저장소로 직접 올려 키만 남는다. 서버가 사진 기능을 껐으면(storage 없음) 이 칸은 나타나지 않는다.
 * 올리는 중이면 `onBusy` 로 알려 계정 설정이 저장 단추를 막는다(키는 올리기가 끝나야 오므로, 그 전에 저장하면 사진이 버려진다).
 * 계정의 사진과 닉네임의 사진은 **서로 다른 파일**이어야 한다(같은 키는 서버가 거절한다) - 칸마다 새로 올린다.
 */
export const profilePicturePicker: ProfilePicturePicker = ({ value, onChange, onBusy }) => (
  <PicturePicker
    value={value ? [value] : []}
    onChange={(keys) => onChange(keys[keys.length - 1] ?? null)}
    onBusyChange={onBusy}
    max={1}
  />
)
