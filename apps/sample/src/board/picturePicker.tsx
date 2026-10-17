import type { AttachmentPicker } from '@skeleton/board'
import { PicturePicker } from './Pictures'

/** 게시판 댓글 폼의 `attachmentPicker` — 그림 고르기 칸 */
export const picturePicker: AttachmentPicker = ({ value, onChange, max }) => (
  <PicturePicker value={value} onChange={onChange} max={max} />
)

/** 로그인하지 않은 사람의 `attachmentPicker` - 비회원 업로드(서버가 켠 경우) */
export const guestPicturePicker: AttachmentPicker = ({ value, onChange, max }) => (
  <PicturePicker value={value} onChange={onChange} max={max} guest />
)
