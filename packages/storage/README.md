# @skeleton/storage

프리사인 업로드 — 파일은 **브라우저가 저장소(S3/R2)로 직접** 올리고, 앱 서버는 presigned URL 만 내준다. 검증 → presign → PUT(진행률 · 취소) → 객체 키(+ 공개 주소), 큰 파일은 멀티파트. SDK 의존 없음.
의존: `@skeleton/api-client`(presign 호출) · `@skeleton/ui`(이미지 부품이 `FilePicker` · `Progress` · `Button` 을 쓴다). peer: `react`(훅 · 부품을 쓰면).

## 어느 백엔드와 짝인가 — 먼저 읽을 것

백엔드 `modules/storage`(kotlin-skeleton)가 **HTTP 엔드포인트를 연다** — 버킷을 정해 `PresignedStorage` 빈이 생기면 `/api/v1/storage/*` 가 등록되고(Spring Security 필요 · 인증 필수 · `skeleton.storage.web.enabled=false` 로 끈다), 이 패키지의 기본 경로가 그것이다. `createStorageApi(apiClient)` 한 줄이면 된다.

| 경로 (baseUrl `/api/v1` 기준)                         | 뜻                                                                                                                                                                                                    | 이 패키지                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `POST /storage/presign`                               | 파일 요약 `{ fileName, contentType, sizeBytes }` → `{ key, method, url, headers, expiresAt }`. 키는 서버가 `<prefix>/<내 계정>/<uuid>/<이름>` 으로 정한다                                             | `api.presignUpload`                                   |
| `POST /storage/presign-download`                      | `{ key }` → 짧은 수명 GET 주소. **내 접두사 아래 키만**(남의 키는 404)                                                                                                                                | `api.presignDownload` · `publicUrlFromDownload`       |
| `POST /storage/validate`                              | 서버 규칙(`skeleton.storage.validation`)으로 검사만 → `{ valid, errors:[{code,message}] }`                                                                                                            | `api.validate`                                        |
| `POST /storage/multipart/{start,part,complete,abort}` | 큰 파일 — 시작 `{ key, uploadId }` · 조각 presign · 완료 · 취소                                                                                                                                       | `api.multipart`                                       |
| `POST /storage/complete` · `/storage/guest/complete`  | **업로드 완료 호출** `{ key }` → `{ key, contentType, sizeBytes, image: { status, width, height } \| null }`. 서버가 올라온 바이트를 보고 거절하면 400 `STORAGE.FILE_REJECTED`(객체는 지워진다). 멱등 | `api.complete` · `createUploader({ complete: true })` |
| `POST /storage/images` (`storage-image` 모듈)         | `{ keys: string[≤20] }` → `{ items: [{ key, status, width, height, variants: { thumb?, display? } }] }` — **내 키만**, 주소는 서명                                                                    | `api.images` · `ImageUploadField` 의 `api`            |

- 서버가 거절하면(`validation` 규칙 위반) presign 이 400 `STORAGE.FILE_REJECTED` 이고 `data.errors` 에 `SIZE_TOO_LARGE` · `UNSUPPORTED_CONTENT_TYPE` · `UNSUPPORTED_EXTENSION` 사유가 온다. 완료 호출(아래)이 같은 응답으로 `CONTENT_MISMATCH`(선언과 내용이 다름) · `UNRECOGNIZED_CONTENT`(알 수 없는 내용) · `IMAGE_TOO_LARGE`(픽셀 상한) · `INSPECTION_REJECTED`(앱이 끼운 검사기)를 더한다.
- 앱이 컨트롤러를 따로 열었다면(`skeleton.storage.web.enabled=false`) 경로를 알려 준다: `createStorageApi(apiClient, storageEndpoints('/files'))` 처럼 뿌리를 바꾸거나 `{ presign, validate?, download?, multipart? }` 를 직접 준다(있는 엔드포인트만 생긴다).
- 응답은 단건 envelope(`{ value, meta }`)이어야 한다. 객체 키는 글자(`"key": "…"`)나 `{ value }` 둘 다 읽는다.
- 업로드한 파일을 바로 열려면(버킷이 비공개 — 기본) `publicUrl: publicUrlFromDownload(api)`. CDN 이 공개 버킷 앞에 있다면 `publicUrlFromBase`, 서버만 만들 수 있는 주소는 `publicUrlFromEndpoint`.

## 쓰는 법

```ts
// src/storage/uploader.ts — 앱이 한 번 만든다
const api = createStorageApi(apiClient) // 기본: 백엔드 모듈의 /storage/* 전부(presign · validate · download · multipart)
export const uploader = createUploader({
  api,
  rules: { maxSizeBytes: 10 * 1024 * 1024, allowedContentTypes: ['image/*'] }, // 선택 — 사용자에게 빨리 알리는 편의, 경계는 서버
  publicUrl: publicUrlFromDownload(api), // 선택 — 올린 키를 짧은 수명 내려받기 주소로
})

// 컴포넌트
const up = useUpload(uploader)
<input type="file" onChange={(e) => up.upload(e.target.files![0]).catch(() => {})} />
<progress value={up.progress} max={1} />   // up.status: idle · uploading · done · error · aborted
{up.result?.key}  <button onClick={up.abort}>Cancel</button>
```

- **거절을 사용자에게 보이려면** `up.error` 를 그린다: `isErrorCode(up.error, ErrorCodes.STORAGE_FILE_REJECTED)` 면 서버 규칙 위반이고 사유(`SIZE_TOO_LARGE` …)는 `up.error.apiError.data.errors` 에 있다. `upload()` 는 던지므로 `.catch(() => {})` 로 받아 상태만 그리는 것이 보통이다.
- **로컬에서 업로드가 되려면** 버킷이 CORS 를 허용해야 한다(브라우저가 저장소로 직접 PUT). 백엔드 레포의 `scripts/dev.sh` 가 올리는 로컬 S3 는 이미 그렇다(`ExposeHeaders: ETag` 포함).

- **큰 파일**: `api.multipart` 가 있고 파일이 `thresholdBytes`(기본 16 MiB)보다 크면 `partSizeBytes`(8 MiB) 조각으로 `concurrency`(3)개씩 올린다. 실패 · 취소하면 서버에 abort 를 부른다. 조각이 `maxParts`(10,000)를 넘으면 조각을 키운다.
- **버킷 CORS**: 브라우저가 직접 PUT 하므로 허용 origin · `PUT` · 보내는 헤더가 필요하고, 멀티파트는 응답 헤더 `ETag` 를 읽어야 해서 **`ExposeHeaders: ETag`** 가 필요하다(없으면 그렇게 말하는 에러).
- `useUpload` 의 `upload()` 는 실패하면 던지고 `status: 'error'` 로 남는다. 취소는 던지지 않고 `null` 을 돌려준다.

## 업로드 검사 — 완료 호출 (`complete`)

브라우저가 저장소로 직접 올리면 서버는 올라온 바이트를 보지 못한다. 서버가 완료 호출을 받아 앞부분을 보고(매직 바이트 · 이미지 크기) 거절하거나 받는다.

```ts
const api = createStorageApi(apiClient)
export const uploader = createUploader({ api, complete: true }) // 기본 false — 옛 서버와 짝일 때 그대로
const result = await uploader.upload(file) // PUT(멀티파트면 합치기) 뒤에 complete 를 부른다
result.inspection // { key, contentType(서버가 판정), sizeBytes, image: { status, width, height } | null }
```

- `complete` 기본은 **꺼짐**이다. 켜는 것은 앱의 선택(`api.complete` 가 없으면 `createUploader` 가 던진다).
- 거절은 `UploadRejectedError`(`errors: [{ code, message }]` — `StorageValidationError` 와 같은 모양). 객체는 서버가 이미 지웠다. 그 밖의 오류(네트워크 · 404)는 그대로 던진다.
- `image.status`: `PENDING`(변환 중) · `READY` · `REJECTED` · `UNSUPPORTED`(미리보기를 못 만드는 형식) · `FAILED`. 이미지 모듈이 없는 서버는 `image: null`. **PDF 키에도 `image` 와 변환본(1쪽 썸네일)이 올 수 있다.**
- 비회원 업로드는 비회원 경로의 업로더를 따로 만들고 완료만 `guestComplete` 로 보낸다: `createStorageApi(client, { presign: <비회원 presign 경로>, complete: storageEndpoints().guestComplete })`.

## 이미지 부품

```tsx
<ImageUploadField
  uploader={uploader} // complete: true 인 업로더(그래야 「처리 중」·거절 문구가 나온다)
  api={api} // 선택 — 이미 붙은 키를 api.images 의 썸네일로 그린다
  value={keys} onChange={setKeys} max={5} accept="image/*"
  labels={koImageUploadLabels}
/>
<StoredImage image={{ width, height, thumb, display }} alt="…" sizes="(min-width: 640px) 50vw, 100vw" />
```

- `ImageUploadField` — `FilePicker` 위: 여러 장 · 고른 즉시 로컬 미리보기(`useFilePreview`) · 장마다 진행률 · 거절 문구(코드 → `labels.reasons`) · 「처리 중」 · 지우기 버튼. `value` 는 올라간 키 목록(순서 = 목록 순서, 순서 바꾸기 · 자르기는 다음). 처리 중 표시는 한 번 읽을 뿐 계속 확인하지 않는다 — 다시 그리면(화면 재진입) 새로 읽는다.
- `StoredImage` — 서버 모양 `{ width, height, thumb?, display? }`(변환본은 `{ url, width?, height? }` 또는 주소 글자 — 게시판 `attachmentImages` 모양)로 `<img src=display srcSet="thumb 400w, display 1600w" width height loading="lazy" decoding="async">`. 한쪽만 있으면 `srcset` 없이 그 하나. `alternates`(`{ 'image/webp': { thumb, display } }` — 서버 엔진이 WebP 도 만들 때)가 있으면 `<picture><source type="image/webp" srcset sizes>` 뒤에 `<img>` 폴백으로 그린다. 폭 · 높이는 자리를 미리 잡아 화면이 밀리지 않게 한다(없으면 뺀다). 주소 글자일 때 폭은 변환본이 긴 변을 `thumb` 400 · `display` 1600 상자에 맞춘다고 보고(키우지 않음) 원본 폭 · 높이로 계산한다 — 폭 · 높이를 모르면 상자 값.
- `StoredImage` 와 움짤 — 변환본의 `contentType`(서버가 `{ url, width, height, contentType }` 로 준다)이 `display` 에서 `video/mp4` 면 `<video src poster=thumb autoplay loop muted playsinline>` 로 그린다(GIF 처럼 보임). 아니면(`image/gif` · `image/webp` · 글자 주소) `<img>`. 영상 판정은 `isVideoVariant` 한 곳이다. 변환은 비동기라 같은 키를 다시 물으면 `display` 의 url · contentType 이 바뀐다.
- `useFilePreview(file)` — 이미지면 `URL.createObjectURL` 주소, 파일이 바뀌거나 사라지면 `revoke`. 이미지가 아니면 `null`.
- 문구는 `labels`(기본 영어, `koImageUploadLabels`) — 코드별 거절 문구는 `labels.reasons[code]`.

## 공개 표면

| export                                                                                           | 뜻                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createStorageApi(client, endpoints = storageEndpoints())`                                       | `presignUpload` · `presignDownload?` · `validate?` · `multipart?`(`start` `presignPart` `complete` `abort`) · `complete?(key)` · `images?(keys)`. 있는 엔드포인트만 생긴다           |
| `storageEndpoints(basePath = '/storage')`                                                        | 백엔드 모듈의 기본 경로 전부. 뿌리만 바꿀 때                                                                                                                                         |
| `createUploader({ api, transport?, rules?, multipart?, publicUrl?, complete? })`                 | `upload(file, { onProgress, signal }) → { key, publicUrl, etag, multipart, inspection? }` (`inspection` 은 `complete: true` 일 때)                                                   |
| `useUpload(uploader)`                                                                            | `{ status, progress, loaded, total, result, error, upload, abort, reset }`                                                                                                           |
| `createUploadController(uploader)`                                                               | `useUpload` 밑의 상태 기계(React 없이)                                                                                                                                               |
| `validateFile(file, rules)` · `StorageFileRules`                                                 | 백엔드 `StorageFileValidator` 와 같은 규칙 · 같은 코드(`SIZE_TOO_LARGE` `UNSUPPORTED_CONTENT_TYPE` `UNSUPPORTED_EXTENSION`). 메시지는 영어 개발자용 — 화면 문구는 코드로 앱이 고른다 |
| `createXhrTransport(XhrClass?)` · `UploadTransport`                                              | `XMLHttpRequest` 로 PUT(fetch 는 업로드 진행률이 없다). 헤더 `Content-Length` · `Host` 는 브라우저가 정하므로 보내지 않는다                                                          |
| `publicUrlFromBase(base)` · `publicUrlFromEndpoint(client, path)` · `publicUrlFromDownload(api)` | 키 → 주소(공개 CDN · 서버가 만든 주소 · 비공개 객체의 짧은 수명 GET presign)                                                                                                         |
| `StorageValidationError` · `UploadRejectedError` · `UploadAbortedError` · `UploadHttpError`      | 거절(요청 전) · 거절(완료 호출에서, 객체는 지워짐) · 취소 · 저장소가 non-2xx(만료된 presign 은 403)                                                                                  |
| `ImageUploadField` · `StoredImage` · `useFilePreview(file)` · `koImageUploadLabels`              | 이미지 부품(위). 스토리: `packages/storage/src/ImageUploadField.stories.tsx` · `StoredImage.stories.tsx`                                                                             |

## 테스트가 재지 않는 것

흐름(검증 → presign → PUT → 키 → 완료 호출, 멀티파트 조각 · 동시성 · ETag 순서 · 실패/취소 시 abort), 요청 모양, 완료 거절 → `UploadRejectedError`, 로컬 미리보기 revoke, `StoredImage` 의 `srcset` · 크기, XHR 어댑터(가짜 `XMLHttpRequest`), 상태 기계, 파일 규칙은 잰다. **재지 않는다**: 진짜 `XMLHttpRequest` · 진짜 S3/R2(presign 서명 · CORS), 실제 큰 파일의 메모리 · 시간, 브라우저에서 `File.slice` 동작, React 상태 갱신 렌더(훅은 초기 렌더만). 실제 버킷으로 한 번 올려 보는 것이 최종 확인이다(백엔드 `docs/storage-s3.md` 도 같은 말을 한다).
