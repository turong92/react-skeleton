import type { ReactNode } from 'react'

/**
 * iframe 다리 — 앱이 자기 메시지 규약으로 구현한다. 무대 · 뷰어는 아래만 부른다.
 * 앱은 다리 객체를 한 번 만들어 유지한다(무대가 바뀐 다리를 받으면 떼고 다시 붙인다).
 * `attach` 말고는 모두 선택 — 없으면 그 기능(펴기 · 모달 창 맞추기 · 바깥 스크롤 · 두 겹)이 꺼진다.
 */
export interface PreviewFrameBridge {
  /** 무대가 iframe 을 붙였다. `spare` 는 `layered` 일 때만(다시 싣기를 뒤 층에서 하고 바꿔 끼운다). 돌려준 함수로 뗀다 */
  attach(frame: HTMLIFrameElement, spare?: HTMLIFrameElement): () => void
  /** 지금 보이는 층. 두 겹을 안 쓰면 없어도 된다(첫 iframe 이 늘 앞) */
  readonly front?: HTMLIFrameElement | null
  /** 앞뒤가 바뀔 때마다 */
  onSwap?(listener: () => void): () => void
  /** 안쪽 문서 높이(px). 알면 펴진 배치(`phone` · `bare` · `scrollBox`)가 iframe 을 이 높이로 늘린다. 모르면 null */
  readonly contentHeight?: number | null
  onHeight?(listener: (height: number | null) => void): () => void
  /** 안쪽에 모달이 열려 있다 — 펴진 무대가 iframe 을 보이는 창만큼 줄여 그 자리에 놓는다 */
  readonly modal?: boolean
  onModal?(listener: (open: boolean) => void): () => void
  /** 모달 동안 안쪽 문서를 이 위치(iframe 안 px)로 스크롤해 잠근다. null 이면 푼다 */
  viewport?(top: number | null): void
  /** 펴진 미리보기가 「안쪽 top 을 보이게」 청한다. room = 그 위에 남길 여유(px) */
  onScrollTo?(listener: (top: number, room: number) => void): () => void
  /** 높이를 알게 된(펴진) 뒤 밀린 스크롤 청을 다시 보낸다 */
  flushScroll?(): void
}

export type PreviewFrameSource = {
  kind: 'frame'
  bridge: PreviewFrameBridge
  /** 기본 `PREVIEW_SANDBOX` */
  sandbox?: string
  /** 뒤 층 iframe 을 하나 더 그려 `attach` 의 `spare` 로 넘긴다. 기본 false */
  layered?: boolean
}

/** 같은 번들의 컴포넌트를 화면 상자(기기 뷰포트 크기) 안에 그대로 그린다 */
export type PreviewRenderSource = { kind: 'render'; content: ReactNode }

export type PreviewSource = PreviewFrameSource | PreviewRenderSource

/** `allow-same-origin` 없이 스크립트만 — 안쪽 문서가 바깥 주소 · 저장소 · 쿠키를 못 읽는다 */
export const PREVIEW_SANDBOX = 'allow-scripts'
