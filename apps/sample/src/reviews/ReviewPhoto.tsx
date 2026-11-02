import { createAuthHeadersProvider } from '@skeleton/auth'
import { Button, Dialog } from '@skeleton/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiClient } from '../api/client'
import { tokenStore } from '../auth/tokenStore'
import { useT } from '../i18n'
import styles from './ReviewPhoto.module.css'

const authHeaders = createAuthHeadersProvider(tokenStore)

/** 서버의 사진 경로가 고르는 변환본 — 목록은 `thumb`, 크게 볼 때 `display`(이미지 모듈이 없는 서버는 둘 다 원본) */
type Variant = 'thumb' | 'display'

function usePhoto(path: string, variant: Variant, enabled = true) {
  return useQuery({
    queryKey: ['reviews', 'photo', path, variant],
    enabled,
    queryFn: async () => {
      const { data, status } = await apiClient.axios.get<Blob>(path, {
        params: { variant },
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
}

/**
 * 리뷰 사진 한 장. 서버의 사진 경로(`GET …/{id}/photos/{index}?variant=thumb|display`)는 로그인이 필요하고 짧은 서명 주소로 `302` 로 넘긴다 -
 * `<img src>` 는 토큰을 못 실으니 클라이언트의 axios 에 토큰 헤더를 붙여 받아 data URL 로 그린다(토큰 갱신 · 오류 변환은 `perform()` 안에만 있어 여기엔 없다 - 만료되면 자리가 빈다).
 * 목록에는 썸네일(`thumb`)만 받고, 누르면 대화상자에서 표시본(`display`)을 받는다. 변환 전이면 남에게는 404 라 자리를 비운다(올린 사람은 원본이 보인다).
 * 같은 사진은 쿼리 캐시가 쥔다. 못 받으면(로그인 전 · 숨겨져 못 보는 사진 · 만료) 자리를 비운다.
 */
export function ReviewPhoto({ path, alt }: { path: string; alt: string }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const thumb = usePhoto(path, 'thumb')
  const display = usePhoto(path, 'display', open)
  if (!thumb.data) return null
  return (
    <>
      <Button
        variant="ghost"
        className={styles.open}
        aria-label={`${alt} - ${t('reviews.photo.enlarge')}`}
        onClick={() => setOpen(true)}
      >
        <img className={styles.photo} src={thumb.data} alt="" />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={alt}
        closeLabel={t('reviews.photo.close')}
      >
        <img className={styles.large} src={display.data ?? thumb.data} alt={alt} />
      </Dialog>
    </>
  )
}

/** blob → data URL - 쿼리 데이터가 글자라 해제할 object URL 이 없다 */
const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
