import type { ReactNode } from 'react'
/**
 * 내 작성자 프로필 한 개 — `GET /author-profiles` 의 한 항목. `id` 는 공개 작성자 id(`prf_…`, 계정 id 가 아니다).
 * `name` · `tag` 는 null 일 수 있다 — 이름 없는 옛 글을 넘겨받은 첫 프로필은 `name` 이 null, 꼬리표 방식이 꺼진 서버는 `tag` 가 null.
 */
export type AuthorProfile = {
  id: string
  name: string | null
  /** 같은 이름의 서로 다른 사람을 구분하는 꼬리표 — 있으면 화면에는 `이름#꼬리표`, 없으면 이름만 */
  tag: string | null
  createdAt: string
  /**
   * 이 프로필만의 사진 키 - **키가 없으면 서버가 사진 기능을 껐다**(`storage` 없음), null 은 켜져 있고 아직 없다. 계정의 사진과는 다른 키여야 한다(같으면 두 프로필이 이어진다 - 서버가 400).
   */
  avatarKey?: string | null
  /** 사진이 있고 기능이 켜졌을 때만 - 공개 주소 · 변환본 · 변환 중 */
  avatar?: ProfileAvatar
}

/** 프로필 사진의 남에게 보이는 모습 - 세 칸이 모두 비면 보일 공개 모습이 없다(공개 영역이 꺼짐) */
export type ProfileAvatar = {
  url?: string
  image?: { width: number; height: number; thumb: string; display: string }
  pending?: boolean
}

/** `GET {basePath}/{id}/avatar` - 짧은 수명의 서명 읽기 주소 */
export type AvatarAddress = { url: string; expiresInSeconds: number }

/**
 * 프로필 사진을 고르는 자리 - 업로드는 앱 몫이다(저장 키 문자열만 오간다. 게시판의 `attachmentPicker` 와 같은 방식이라 이 패키지는 `@skeleton/storage` 를 모른다).
 * 사진을 올리면 `onChange(키)`, 지우면 `onChange(null)`. 보통 `ImageUploadField` 를 `max={1}` 로 감싼다. 프로필마다 새로 올린 파일의 키여야 한다.
 */
export type ProfilePicturePicker = (args: {
  value: string | null
  onChange: (key: string | null) => void
}) => ReactNode

/** `GET /author-profiles/config` */
export type AuthorProfileConfig = {
  /** 계정당 살아 있는 프로필 수 상한 */
  maxPerAccount: number
  /** 이름 길이 상한(코드 포인트) */
  nameMaxLength: number
}

/** `POST` · `PATCH` 본문 */
export type AuthorProfileInput = { name: string }

/**
 * 화면에 그리는 `이름#꼬리표` — 꼬리표가 없으면 `#` 도 없고, 이름이 없으면 `unnamed`(앱이 번역해 준 「이름 없음」, 기본 `Unnamed`)로 대신한다.
 */
export const profileDisplay = (
  profile: Pick<AuthorProfile, 'name' | 'tag'>,
  unnamed = 'Unnamed',
): string => `${profile.name ?? unnamed}${profile.tag ? `#${profile.tag}` : ''}`
