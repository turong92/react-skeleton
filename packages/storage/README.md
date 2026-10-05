# @skeleton/storage

프리사인 업로드 — 파일은 **브라우저가 저장소(S3/R2)로 직접** 올리고, 앱 서버는 presigned URL 만 내준다. 검증 → presign → PUT(진행률 · 취소) → 객체 키(+ 공개 주소), 큰 파일은 멀티파트. SDK 의존 없음.
의존: `@skeleton/api-client`(presign 호출). peer: `react`(`useUpload` 만 쓰면).

## 어느 백엔드와 짝인가 — 먼저 읽을 것

| 쓰는 것                         | 백엔드                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| presign · 멀티파트(재사용 계약) | `modules/storage` 의 `PresignedStorage`(`presignUpload` · `startMultipartUpload` · `presignMultipartUploadPart` · `completeMultipartUpload` · `abortMultipartUpload`) + `storage-s3`. **서비스 계약일 뿐 HTTP 엔드포인트가 모듈에 없다** — 앱이 컨트롤러를 만들고 위 서비스를 부른다. 그래서 이 패키지에는 **기본 경로가 없다**(`endpoints` 로 알려 준다) |
| 서버 검증(선택, 데모)           | `StorageFileValidator`(`modules/storage`). workbench 가 `POST /skeleton/storage/validate` 로 열어 둔 것과 같은 모양(`{ valid, errors:[{code,message}] }`)이면 `endpoints.validate` 로 쓴다                                                                                                                                                                |
| 공개 주소(선택, 데모)           | `StoragePublicUrlResolver`. workbench 의 `GET /skeleton/storage/public-url?key=` → `{ key, publicUrl, available }` 이면 `publicUrlFromEndpoint`. CDN 주소 + 키면 `publicUrlFromBase`                                                                                                                                                                      |

앱 컨트롤러가 돌려줄 모양(단건 envelope `{ value }`, Kotlin DTO 그대로): presign → `PresignedUrl { key, method, url, headers }`, 멀티파트 start → `{ key, uploadId }`, part → `PresignedMultipartUploadPart`, complete → `CompletedMultipartUpload`. `ObjectKey` 가 `{ value }` 로 직렬화돼도 글자로 읽는다. 요청 본문은 `{ fileName, contentType, sizeBytes }`(= `StorageFileCandidate`) — **키는 서버가 정한다**(클라이언트가 고르지 않는다).

## 쓰는 법

```ts
// src/storage/uploader.ts — 앱이 한 번 만든다
const api = createStorageApi(apiClient, {
  presign: '/files/presign', // ← 내 앱이 연 경로
  validate: '/files/validate', // 선택
  multipart: { start: '/files/mp/start', part: '/files/mp/part', complete: '/files/mp/complete', abort: '/files/mp/abort' }, // 선택(넷 다)
})
export const uploader = createUploader({
  api,
  rules: { maxSizeBytes: 10 * 1024 * 1024, allowedContentTypes: ['image/*'] }, // 선택 — 사용자에게 빨리 알리는 편의, 경계는 서버
  publicUrl: publicUrlFromBase('https://cdn.example.com/uploads'),
})

// 컴포넌트
const up = useUpload(uploader)
<input type="file" onChange={(e) => up.upload(e.target.files![0]).catch(() => {})} />
<progress value={up.progress} max={1} />   // up.status: idle · uploading · done · error · aborted
{up.result?.key}  <button onClick={up.abort}>Cancel</button>
```

- **큰 파일**: `api.multipart` 가 있고 파일이 `thresholdBytes`(기본 16 MiB)보다 크면 `partSizeBytes`(8 MiB) 조각으로 `concurrency`(3)개씩 올린다. 실패 · 취소하면 서버에 abort 를 부른다. 조각이 `maxParts`(10,000)를 넘으면 조각을 키운다.
- **버킷 CORS**: 브라우저가 직접 PUT 하므로 허용 origin · `PUT` · 보내는 헤더가 필요하고, 멀티파트는 응답 헤더 `ETag` 를 읽어야 해서 **`ExposeHeaders: ETag`** 가 필요하다(없으면 그렇게 말하는 에러).
- `useUpload` 의 `upload()` 는 실패하면 던지고 `status: 'error'` 로 남는다. 취소는 던지지 않고 `null` 을 돌려준다.

## 공개 표면

| export                                                                | 뜻                                                                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createStorageApi(client, endpoints)`                                 | `presignUpload` · `validate?` · `multipart?`(`start` `presignPart` `complete` `abort`). 있는 엔드포인트만 생긴다                                                                     |
| `createUploader({ api, transport?, rules?, multipart?, publicUrl? })` | `upload(file, { onProgress, signal }) → { key, publicUrl, etag, multipart }`                                                                                                         |
| `useUpload(uploader)`                                                 | `{ status, progress, loaded, total, result, error, upload, abort, reset }`                                                                                                           |
| `createUploadController(uploader)`                                    | `useUpload` 밑의 상태 기계(React 없이)                                                                                                                                               |
| `validateFile(file, rules)` · `StorageFileRules`                      | 백엔드 `StorageFileValidator` 와 같은 규칙 · 같은 코드(`SIZE_TOO_LARGE` `UNSUPPORTED_CONTENT_TYPE` `UNSUPPORTED_EXTENSION`). 메시지는 영어 개발자용 — 화면 문구는 코드로 앱이 고른다 |
| `createXhrTransport(XhrClass?)` · `UploadTransport`                   | `XMLHttpRequest` 로 PUT(fetch 는 업로드 진행률이 없다). 헤더 `Content-Length` · `Host` 는 브라우저가 정하므로 보내지 않는다                                                          |
| `publicUrlFromBase(base)` · `publicUrlFromEndpoint(client, path)`     | 키 → 공개 주소                                                                                                                                                                       |
| `StorageValidationError` · `UploadAbortedError` · `UploadHttpError`   | 거절(요청 전) · 취소 · 저장소가 non-2xx(만료된 presign 은 403)                                                                                                                       |

## 테스트가 재지 않는 것

흐름(검증 → presign → PUT → 키, 멀티파트 조각 · 동시성 · ETag 순서 · 실패/취소 시 abort), 요청 모양, XHR 어댑터(가짜 `XMLHttpRequest`), 상태 기계, 파일 규칙은 잰다. **재지 않는다**: 진짜 `XMLHttpRequest` · 진짜 S3/R2(presign 서명 · CORS), 실제 큰 파일의 메모리 · 시간, 브라우저에서 `File.slice` 동작, React 상태 갱신 렌더(훅은 초기 렌더만). 실제 버킷으로 한 번 올려 보는 것이 최종 확인이다(백엔드 `docs/storage-s3.md` 도 같은 말을 한다).
