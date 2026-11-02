import { ImageUploadField, defaultImageUploadLabels, koImageUploadLabels } from '@skeleton/storage'
import { languageOf, useT } from '../i18n'
import { guestUploader, storageApi, uploader } from '../storage/uploader'

/**
 * 댓글 · 리뷰에 사진을 붙이는 칸 — 파일은 브라우저가 저장소로 직접 올리고 폼에는 키만 남는다(`@skeleton/storage` 의 `ImageUploadField`).
 * 올리면 서버가 내용을 보고(완료 호출) 거절하거나 변환을 시작한다: 고른 즉시 로컬 미리보기, 끝나면 「처리 중」 표시.
 * 로그인한 사람은 자기 업로드(붙은 키는 서버 썸네일로), 비회원은 비회원 업로드(`guest`) - 서버 썸네일을 받을 길이 없어 올린 직후의 미리보기만 보인다.
 */
export function PicturePicker({
  value,
  onChange,
  max,
  guest = false,
}: {
  value: string[]
  onChange: (keys: string[]) => void
  max: number
  guest?: boolean
}) {
  const { t, locale } = useT()
  const base = languageOf(locale) === 'ko' ? koImageUploadLabels : defaultImageUploadLabels
  const remove = t('board.pictures.remove')
  return (
    <ImageUploadField
      uploader={guest ? guestUploader : uploader}
      api={guest ? undefined : storageApi}
      value={value}
      onChange={onChange}
      max={max}
      accept={guest ? 'image/png,image/jpeg,image/gif,image/webp' : undefined}
      labels={{
        ...base,
        title: t('board.pictures.pickTitle'),
        hint: t(guest ? 'board.pictures.guestHint' : 'board.pictures.pickHint'),
        chooseButton: t('board.pictures.pickButton'),
        remove,
        removeNamed: (name) => `${name} ${remove}`,
      }}
    />
  )
}
