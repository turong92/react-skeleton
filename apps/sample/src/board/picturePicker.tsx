import type { AttachmentPicker } from '@skeleton/board'
import { PicturePicker } from './Pictures'

/** 게시판 댓글 폼의 `attachmentPicker` — 그림 고르기 칸 */
export const picturePicker: AttachmentPicker = ({ value, onChange, max }) => (
  <PicturePicker value={value} onChange={onChange} max={max} />
)
