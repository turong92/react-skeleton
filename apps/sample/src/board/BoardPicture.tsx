import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import styles from './Pictures.module.css'

/**
 * 게시판에 붙은 사진 한 장. 공개된 항목의 사진은 서버가 준 공개 주소(CDN)로 그린다. 공개되지 않은 사진(승인 전 · 판)은 [access] 로
 * 관리하는 사람 · 작성자만 짧은 서명 주소를 받는다 - 못 받으면(권한 없음 · 만료 · 기능 꺼짐) 그림 자리를 비운다.
 */
export function BoardPicture({
  url,
  access,
}: {
  /** 서버가 준 공개 주소 (`attachmentUrls[key]`) */
  url?: string
  /** 공개 주소가 없을 때 서명 주소를 받는 호출 */
  access?: () => Promise<string>
}) {
  const { t } = useT()
  const [signed, setSigned] = useState<string>()
  useEffect(() => {
    if (url || !access) return
    let live = true
    access()
      .then((value) => live && setSigned(value))
      .catch(() => undefined)
    return () => {
      live = false
    }
    // access 는 매 렌더 새 함수다 - 주소가 없을 때 한 번만 받는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])
  const src = url ?? signed
  return src ? <img className={styles.picture} src={src} alt={t('board.pictures.alt')} /> : null
}
