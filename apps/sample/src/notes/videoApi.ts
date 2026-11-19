import { createVideoApi } from '@skeleton/video'
import { apiClient } from '../api/client'

/** 앱 전역 영상 API(`/api/v1/videos`) — 노트에 붙이는 영상만(목적 `note`, 늘 비공개) */
export const videoApi = createVideoApi(apiClient)

/** 서버 `NoteVideoPolicy.PURPOSE` */
export const NOTE_VIDEO_PURPOSE = 'note'
