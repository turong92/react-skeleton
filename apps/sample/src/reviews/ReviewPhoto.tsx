import { createAuthHeadersProvider } from '@skeleton/auth'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { tokenStore } from '../auth/tokenStore'
import styles from './ReviewPhoto.module.css'

const authHeaders = createAuthHeadersProvider(tokenStore)

/**
 * 리뷰 사진 한 장. 서버의 사진 경로(`GET …/{id}/photos/{index}`)는 로그인이 필요하고 짧은 서명 주소로 `302` 로 넘긴다 -
 * `<img src>` 는 토큰을 못 실으니 클라이언트의 axios 에 토큰 헤더를 붙여 받아 data URL 로 그린다(토큰 갱신 · 오류 변환은 `perform()` 안에만 있어 여기엔 없다 - 만료되면 자리가 빈다).
 * 같은 사진은 쿼리 캐시가 쥔다. 못 받으면(로그인 전 · 숨겨져 못 보는 사진 · 만료) 자리를 비운다.
 */
export function ReviewPhoto({ path, alt }: { path: string; alt: string }) {
  const photo = useQuery({
    queryKey: ['reviews', 'photo', path],
    queryFn: async () => {
      const { data, status } = await apiClient.axios.get<Blob>(path, {
        responseType: 'blob',
        headers: authHeaders(),
      })
      // 이 axios 는 모든 상태를 성공으로 푼다(`validateStatus: () => true`) - 오류 본문이 그림이 되지 않게 직접 실패로 다룬다
      if (status !== 200 || !data.type.startsWith('image/'))
        // createQueryClient 가 meta.quietStatuses 를 맞춰 볼 수 있게 apiError.status 를 싣는다 - 맨 Error 면 비로그인 화면에 토스트가 장수만큼 뜬다
        throw Object.assign(new Error(`review photo ${path} → ${status}`), { apiError: { status } })
      return toDataUrl(data)
    },
    retry: false,
    staleTime: 60_000,
    meta: { quietStatuses: [401, 403, 404] },
  })
  return photo.data ? <img className={styles.photo} src={photo.data} alt={alt} /> : null
}

/** blob → data URL - 쿼리 데이터가 글자라 해제할 object URL 이 없다 */
const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
