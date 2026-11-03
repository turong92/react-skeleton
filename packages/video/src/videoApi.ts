import type { ApiClient } from '@skeleton/api-client'
import type {
  CompletedPart,
  PartTarget,
  StartedVideo,
  UploadedPart,
  VideoItem,
  VideoPlayback,
  VideoVisibility,
} from './types'

type VideoClient = Pick<ApiClient, 'value' | 'list' | 'noContent'>

export type VideoApi = {
  /** `POST {base}` - 줄을 `UPLOADING` 으로 두고 멀티파트를 시작한다. 정책 · 쿼터 · 4GB 를 서버가 본다 */
  start(input: {
    bytes: number
    contentType: string
    purpose: string
    visibility: VideoVisibility
  }): Promise<StartedVideo>
  /** `POST {base}/{id}/parts { numbers }` - 조각마다 서명된 `PUT` 주소 */
  presignParts(id: string, numbers: number[]): Promise<PartTarget[]>
  /** `GET {base}/{id}/parts` - 저장소에 이미 올라간 조각(이어 올리기). 모르는 올리기면 404 */
  listParts(id: string): Promise<UploadedPart[]>
  /** `POST {base}/{id}/complete { parts }` - 멀티파트를 마치고 처리 줄에 넣는다(멱등) */
  complete(id: string, parts: CompletedPart[]): Promise<VideoItem>
  /** `DELETE {base}/{id}` - 올리는 중이면 중단하고, 영상 폴더를 지운다. 내 영상이 아니면 404 */
  remove(id: string): Promise<void>
  /** `GET {base}?purpose=` - 내 영상들(올린 순서) */
  list(purpose: string): Promise<VideoItem[]>
  /** `PUT {base}/{id}/poster { key }` - 포스터를 내가 올린 이미지(`/storage` 로 올려 완료한 키)로 바꿔 끼운다. 204. 409 `VIDEO.POSTER_PENDING` 이면 1~2초 뒤 같은 호출을 반복, 422 `VIDEO.POSTER_REJECTED` 는 거절 */
  setPoster(id: string, key: string): Promise<void>
  /** `POST {base}/{id}/playback` - 재생 허가. 아직 `PLAYABLE` 이 아니면 409 `VIDEO.NOT_READY` */
  playback(id: string): Promise<VideoPlayback>
}

export type VideoApiOptions = {
  /** 컨트롤러 경로(기본 `/videos`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
}

/** 영상 HTTP 호출. 로그인 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다. 파일 바이트는 서버를 지나지 않는다 */
export function createVideoApi(
  client: VideoClient,
  { basePath = '/videos' }: VideoApiOptions = {},
): VideoApi {
  const base = basePath.replace(/\/+$/, '')
  const video = (id: string) => `${base}/${encodeURIComponent(id)}`
  return {
    start: (input) => client.value<StartedVideo>(base, { method: 'POST', json: input }),
    presignParts: (id, numbers) =>
      client.list<PartTarget>(`${video(id)}/parts`, { method: 'POST', json: { numbers } }),
    listParts: (id) => client.list<UploadedPart>(`${video(id)}/parts`),
    complete: (id, parts) =>
      client.value<VideoItem>(`${video(id)}/complete`, { method: 'POST', json: { parts } }),
    remove: (id) => client.noContent(video(id), { method: 'DELETE' }),
    list: (purpose) => client.list<VideoItem>(base, { params: { purpose } }),
    setPoster: (id, key) =>
      client.noContent(`${video(id)}/poster`, { method: 'PUT', json: { key } }),
    playback: (id) => client.value<VideoPlayback>(`${video(id)}/playback`, { method: 'POST' }),
  }
}
