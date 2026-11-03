# @skeleton/video

영상 올리기 · 재생 — 파일은 **브라우저가 저장소로 직접** 올리고(조각 동시 올리기 · 실패한 조각만 다시 · 새로 고침 뒤 이어 올리기), 변환은 서버의 별도 일꾼이 하며, 이 패키지는 그 진행 상태를 보이고 결과를 튼다. 백엔드 `modules/video`(+ `video-jdbc`, 저장소는 `storage`)의 짝.
의존: `@skeleton/api-client` · `@skeleton/ui`(올리기 칸이 `FilePicker` · `Progress` · `Button` 을 쓴다) · **`hls.js` 1.7.3 고정**(재생 부품이 쓴다 — 이 패키지를 안 쓰는 앱은 받지 않는다). peer: `react` · `@tanstack/react-query`.

## 어느 백엔드와 짝인가

경로는 baseUrl `/api/v1` 기준이다(`createVideoApi(apiClient, { basePath? })`, 기본 `/videos`). 응답은 envelope(`value` / `list`)다.

| 경로                         | 뜻                                                                                                                                                                                   | 이 패키지                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `POST /videos`               | `{ bytes, contentType, purpose, visibility }` → `{ id, uploadId, partSize }`. 정책 · 쿼터 · 4GB 상한을 서버가 본다                                                                   | `api.start`                    |
| `POST /videos/{id}/parts`    | `{ numbers }` → `[{ number, method, url, headers }]` 조각마다 서명된 `PUT` 주소                                                                                                      | `api.presignParts`             |
| `GET /videos/{id}/parts`     | → `[{ n, etag, bytes }]` 저장소에 이미 올라간 조각(이어 올리기). 모르는 올리기면 404                                                                                                 | `api.listParts`                |
| `POST /videos/{id}/complete` | `{ parts: [{ n, etag }] }` → 목록의 한 줄(`VideoItem`). 멱등                                                                                                                         | `api.complete`                 |
| `DELETE /videos/{id}`        | 204. 올리는 중이면 멀티파트를 중단하고 영상 폴더를 지운다                                                                                                                            | `api.remove`                   |
| `GET /videos?purpose=`       | → `VideoItem[]`(올린 순서)                                                                                                                                                           | `api.list` · `useVideos`       |
| `PUT /videos/{id}/poster`    | `{ key }`(내가 `/storage` 로 올려 완료한 이미지 키) → 204. 409 `VIDEO.POSTER_PENDING` 이면 1~2초 뒤 같은 호출 반복, 422 `VIDEO.POSTER_REJECTED` 는 거절. 화면 부품은 없다(앱이 조립) | `api.setPoster`                |
| `POST /videos/{id}/playback` | → `{ src, compat?, hls?, poster, codec, w, h, durationMs, big, expiresAt? }`. 아직 `PLAYABLE` 이 아니면 409 `VIDEO.NOT_READY`                                                        | `api.playback` · `VideoPlayer` |

`VideoItem` = `{ id, purpose, visibility, status, bytes, compat, ladder, progress, failCode, width, height, durationMs, createdAt }`.
`status` 는 `UPLOADING` → `UPLOADED` → `QUEUED` → `REMUXING` → `PLAYABLE` | `FAILED` | `DELETED`, `compat` · `ladder`(호환 단 · 사다리)는 `NONE` · `SKIPPED` · `QUEUED` · `RUNNING` · `READY` · `FAILED`, `progress` 는 일꾼이 보고한 0~100(모르면 `null`), `failCode` 는 `UNSUPPORTED_FORMAT` · `CORRUPT` · `LIMITS_EXCEEDED` · `TOO_BIG_FOR_WORKER` · `PROCESSING_FAILED` · `LEASE_EXPIRED` · `UPLOAD_ABANDONED`.
**`PLAYABLE` 은 원본 단이 올라간 순간**이다 — 호환 · 사다리 트랙이 아직이거나 실패해도 재생은 된다.

## 쓰는 법

```tsx
const videoApi = createVideoApi(apiClient) // 앱이 한 번 만든다

// 올리기 칸 — QueryClientProvider 안에서
<VideoUploadField api={videoApi} purpose="note-clip" visibility="PRIVATE" labels={koVideoUploadLabels} />

// 재생 — 재생 허가를 받아 grant 로. 비공개 영상은 토큰이 끝나면 새 허가를 받아 같은 시각에서 이어 본다
const grant = await videoApi.playback(video.id)
<VideoPlayer grant={grant} refreshGrant={() => videoApi.playback(video.id)} labels={koVideoPlayerLabels} />

// 칸 없이 직접 올리기
const done = await uploadVideo(videoApi, file, { purpose: 'note-clip', visibility: 'PRIVATE', resume: true, onProgress: (sent) => {} })
```

| 내보내기                                                                                                | 하는 일                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createVideoApi(client, { basePath? })`                                                                 | 위 표의 호출 모음                                                                                                                                                                                                                                                                                                                                 |
| `uploadVideo(api, file, options)`                                                                       | mp4 · mov 만(비면 확장자로 짐작, 아니면 `UnsupportedVideoFileError`) → 시작 → 조각을 서버가 준 크기로 잘라 3개씩 병렬 `PUT`(조각마다 4번까지, 다시 보낼 땐 그 조각만 새 서명 주소) → 마치기. 진행률 `onProgress(sent)` 는 줄지 않는다 · 취소 `signal` → `AbortError` · 끝내 안 되는 조각 `UploadPartError` · 서버 거절은 `ApiRequestError` 그대로 |
| `uploadVideo(…, { resume: true })`                                                                      | `{ 영상 번호, uploadId, 조각 크기 }` 를 파일 지문(목적 · 이름 · 크기 · 수정 시각)으로 `localStorage` 에 두고, 같은 파일을 다시 고르면 `GET parts` 로 빠진 조각만 올린다(크기가 다른 조각은 다시). 서버가 모르는 올리기(404)거나 기록에 `uploadId` 가 없으면 처음부터. 끝나면 기록을 비운다                                                        |
| `useVideos(api, purpose)`                                                                               | 목록. 서버가 만드는 중(처리 중 · 호환 / 사다리 판 만드는 중)이면 3초마다 다시 읽고, 끝나면 멈춘다. 키 `videosKey(purpose)`                                                                                                                                                                                                                        |
| `VideoUploadField`                                                                                      | `FilePicker` + 올리는 중 % → 준비 중 n% → 「재생할 수 있어요」 → 「다른 기기용 판 준비 중」 → 끝. 실패는 사유 코드 → 문구, 올리다 만 줄은 안내, 줄마다 지우기 · 올리는 중에는 취소. `max`(기본 1) · `visibility`(기본 비공개) · `resume`(기본 켬)                                                                                                 |
| `VideoPlayer`                                                                                           | 아래                                                                                                                                                                                                                                                                                                                                              |
| `defaultVideoUploadLabels` · `koVideoUploadLabels` · `defaultVideoPlayerLabels` · `koVideoPlayerLabels` | 문구(영어 기본 · 한국어). 일부만 바꿀 때는 `{ ...default…Labels, … }`                                                                                                                                                                                                                                                                             |

## 재생 순서 · 화질 칩 (`VideoPlayer`)

- 처음엔 포스터 + 재생 단추뿐이다 — **누르기 전에는 영상 파일도 hls.js 도 받지 않는다.**
- 엔진: 브라우저가 HLS 를 직접 틀면(`canPlayType`) `<video src>`, 아니면 MSE 가 있을 때 **hls.js light(1.7.3, gzip 약 119KB)를 누를 때 지연 로드**, 둘 다 없으면 「이 브라우저에서는 재생할 수 없어요」(단추는 막힌다).
- 순서: **마스터(자동) → (기기가 원본 코덱을 틀면) 원본 단 → 호환 단**. 큰 원본(`big`)이고 호환 단이 있으면 호환 단이 기본이고 원본은 칩에서 고를 때만 받는다. 틀 수 있는 판이 아직 없으면 포스터 + 「영상 준비 중이에요」(단추 막힘). 한 걸음이 틀지 못하면(`error` · hls.js 치명 오류) **같은 시각에서** 다음 걸음으로, 다 실패하면 안내하고 다시 누를 수 있다.
- 화질 칩 「자동 / 720p / 원본」은 고를 것이 둘 이상일 때만 뜬다. 바꿔도 시각을 잇는다. 큰 원본인데 호환 단이 아직 없으면 720p 는 「준비 중」으로 흐리게 보인다.
- **비공개 토큰**: `refreshGrant` 를 주면, 재생 전에 토큰이 곧(30초 안) 끝나거나 재생 중 틀지 못했는데 `expiresAt` 이 지났으면 새 허가를 받아(한 번) **같은 걸음을 같은 시각에서** 다시 튼다.
- `controlsList="nodownload"` · 내려받기 단추 없음(저장소에 영상 한 덩어리가 없다).
- `env`(이 기기가 무엇을 트는가) · `loadHls` 는 시험 · 스토리에서 갈래를 보이려고 바꿔 끼우는 prop 이다 — 앱은 주지 않는다.

## 알아 둘 것

- 저장소(버킷) CORS 가 `PUT` · `GET` 을 열고 `ExposeHeaders: ETag` 여야 한다(조각 응답의 `ETag` 를 읽는다).
- 올리기 취소(칸의 「취소」)는 서버의 그 영상도 지운다. 화면을 떠나거나 새로 고침으로 멈춘 올리기는 서버에 남아(마지막 움직임 1시간 뒤 서버가 치운다) 같은 파일을 다시 고르면 이어진다.
- 올리기 오류 문구는 `VIDEO.UNSUPPORTED` · `VIDEO.TOO_LARGE` · `VIDEO.QUOTA` 코드를 알고, 그 밖은 일반 문구다.
- 스토리: `Packages/video/VideoUploadField`(가짜 서버가 단계를 한 걸음씩 보낸다) · `Packages/video/VideoPlayer`(네이티브 / hls.js 지연 로드 / 다음 걸음으로 / 칩 / 토큰 만료 / 준비 중 / 못 틂).
