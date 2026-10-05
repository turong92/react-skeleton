import { useEffect, useState, useSyncExternalStore } from 'react'
import { createUploadController } from './controller'
import type { Uploader } from './uploader'

/**
 * 업로드 한 줄기 — `const up = useUpload(uploader)` → `up.upload(file)` · `up.progress`(0..1) · `up.status`
 * (`idle` · `uploading` · `done` · `error` · `aborted`) · `up.result`(`{ key, publicUrl }`) · `up.error` · `up.abort()` · `up.reset()`.
 * `uploader` 는 처음 값으로 고정된다(앱에서 한 번 만들어 넘긴다). 언마운트하면 진행 중인 업로드를 취소한다.
 * 실패는 `upload()` 가 던지고 상태에도 남는다 — 전역 에러 토스트를 쓰는 앱이면 `.catch(() => {})` 로 받아도 된다.
 */
export function useUpload(uploader: Uploader) {
  const [controller] = useState(() => createUploadController(uploader))
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  useEffect(() => () => controller.abort(), [controller])
  return { ...state, upload: controller.upload, abort: controller.abort, reset: controller.reset }
}
