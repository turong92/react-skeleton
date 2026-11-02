import { useEffect, useState, useSyncExternalStore } from 'react'
import { createFilePreview } from './filePreview'

/**
 * 고른 파일의 로컬 미리보기 주소 — 이미지면 `URL.createObjectURL`, 파일이 바뀌거나 사라지거나 언마운트되면 `revoke` 한다.
 * 이미지가 아니면(또는 파일이 `null` 이면) `null`. 올리기 전에 보여 주는 용도라 서버를 거치지 않는다.
 */
export function useFilePreview(file: File | null): string | null {
  const [preview] = useState(() => createFilePreview())
  const shown = useSyncExternalStore(preview.subscribe, preview.getSnapshot, preview.getSnapshot)
  useEffect(() => {
    preview.show(file)
    return preview.dispose
  }, [preview, file])
  // 새 파일의 effect 가 돌기 전까지 이전 파일의(곧 revoke 될) 주소를 내밀지 않는다
  return shown.file === file ? shown.url : null
}
