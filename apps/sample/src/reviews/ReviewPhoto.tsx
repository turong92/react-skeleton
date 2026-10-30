import { createAuthHeadersProvider } from '@skeleton/auth'
import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { tokenStore } from '../auth/tokenStore'
import styles from './ReviewPhoto.module.css'

const authHeaders = createAuthHeadersProvider(tokenStore)

/**
 * 리뷰 사진 한 장. 서버의 사진 경로(`GET …/{id}/photos/{index}`)는 로그인이 필요하고 짧은 서명 주소로 `302` 로 넘긴다 -
 * `<img src>` 는 토큰을 못 실으니 앱이 토큰으로 받아 그린다. 못 받으면(로그인 전 · 숨겨져 못 보는 사진 · 만료) 자리를 비운다.
 */
export function ReviewPhoto({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let live = true
    let objectUrl: string | undefined
    void (async () => {
      try {
        const response = await fetch(apiClient.endpoint(path), { headers: authHeaders() })
        if (!response.ok) return
        objectUrl = URL.createObjectURL(await response.blob())
        if (live) setSrc(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      } catch {
        // 그림 자리를 비운다
      }
    })()
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])
  return src ? <img className={styles.photo} src={src} alt={alt} /> : null
}
