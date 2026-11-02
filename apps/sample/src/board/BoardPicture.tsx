import { StoredImage, type StoredImageSource } from '@skeleton/storage'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import styles from './Pictures.module.css'

/** 변환 중인 사진을 다시 읽기까지 기다리는 시간 */
const RECHECK_MS = 4000

/**
 * 게시판에 붙은 사진 한 장. 공개된 항목의 사진은 서버가 준 변환본(`image` = `attachmentImages[key]`: 썸네일 · 표시본 · 폭 · 높이 · WebP 대안)을
 * `StoredImage` 로 그린다 - 변환본이 없으면(이미지 모듈이 없는 서버 · PDF) 공개 주소(`url`) 그대로.
 * 변환 중(`pending` = `attachmentsPending` 에 있는 키)이면 「처리 중」 을 보이고 잠시 뒤 게시판 쿼리를 다시 읽는다.
 * 공개되지 않은 사진(승인 전 · 판)은 [access] 로 관리하는 사람 · 작성자만 짧은 서명 주소를 받는다 - 못 받으면(권한 없음 · 만료 · 기능 꺼짐) 그림 자리를 비운다.
 */
export function BoardPicture({
  url,
  image,
  pending = false,
  access,
}: {
  /** 서버가 준 공개 주소 (`attachmentUrls[key]`) */
  url?: string
  /** 서버가 준 변환본 (`attachmentImages[key]`) */
  image?: StoredImageSource
  /** 변환 중이다 (`attachmentsPending` 에 이 키가 있다) */
  pending?: boolean
  /** 공개 주소가 없을 때 서명 주소를 받는 호출 */
  access?: () => Promise<string>
}) {
  const { t } = useT()
  const queryClient = useQueryClient()
  const [signed, setSigned] = useState<string>()
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: ['board'] }),
      RECHECK_MS,
    )
    return () => clearTimeout(timer)
  }, [pending, queryClient])
  useEffect(() => {
    if (url || image || pending || !access) return
    let live = true
    access()
      .then((value) => live && setSigned(value))
      .catch(() => undefined)
    return () => {
      live = false
    }
    // access 는 매 렌더 새 함수다 - 주소가 없을 때 한 번만 받는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, image, pending])
  const alt = t('board.pictures.alt')
  if (image) return <StoredImage image={image} alt={alt} className={styles.picture} sizes="12rem" />
  if (pending) return <p role="status">{t('board.pictures.processing')}</p>
  const src = url ?? signed
  return src ? <img className={styles.picture} src={src} alt={alt} /> : null
}
