/** `ImageUploadField` 의 화면 문구 — 기본은 영어, `koImageUploadLabels` 는 한국어. 일부만 덮을 때는 `{ ...defaultImageUploadLabels, … }` */
export type ImageUploadLabels = {
  /** 고르는 구역의 이름 */
  title: string
  /** 고르는 구역의 안내(보이지 않게 하려면 `undefined`) */
  hint?: string
  chooseButton: string
  /** 칸마다 있는 지우기 버튼(보이는 글자) */
  remove: string
  /** 지우기 버튼의 낭독 이름 — 어느 사진인지 */
  removeNamed: (name: string) => string
  /** 진행률 막대의 낭독 이름 */
  uploading: (name: string) => string
  /** 서버가 변환본을 만드는 중(`PENDING`) */
  processing: string
  /** 변환본을 못 만드는 형식(`UNSUPPORTED`) */
  unsupported: string
  /** 처리 실패 · 거절된 이미지(`REJECTED` · `FAILED`) */
  unavailable: string
  /** 거절 코드별 문구 — 서버 코드(`CONTENT_MISMATCH` …)와 클라이언트 규칙 코드가 같은 표를 쓴다 */
  reasons: Record<string, string>
  /** `reasons` 에 없는 코드 */
  rejected: string
  /** 거절이 아닌 실패(네트워크 · 저장소 오류) */
  failed: string
  /** 상한에 닿았을 때 구역 아래에 보이는 안내 */
  limitReached: (max: number) => string
}

export const defaultImageUploadLabels: ImageUploadLabels = {
  title: 'Add photos',
  hint: 'Drag files here or choose them',
  chooseButton: 'Choose photos',
  remove: 'Remove',
  removeNamed: (name) => `Remove ${name}`,
  uploading: (name) => `Uploading ${name}`,
  processing: 'Processing…',
  unsupported: 'No preview can be made for this format.',
  unavailable: 'This photo cannot be used.',
  reasons: {
    SIZE_TOO_LARGE: 'The file is too large.',
    UNSUPPORTED_CONTENT_TYPE: 'This file type is not allowed.',
    UNSUPPORTED_EXTENSION: 'This file type is not allowed.',
    CONTENT_MISMATCH: 'The file content does not match its type.',
    UNRECOGNIZED_CONTENT: 'The file could not be recognized.',
    IMAGE_TOO_LARGE: 'The image has too many pixels.',
    INSPECTION_REJECTED: 'This file cannot be used.',
  },
  rejected: 'This file cannot be used.',
  failed: 'Upload failed. Please try again.',
  limitReached: (max) => `You can add up to ${max}.`,
}

export const koImageUploadLabels: ImageUploadLabels = {
  title: '사진 추가',
  hint: '파일을 끌어다 놓거나 골라 주세요',
  chooseButton: '사진 고르기',
  remove: '지우기',
  removeNamed: (name) => `${name} 지우기`,
  uploading: (name) => `${name} 올리는 중`,
  processing: '처리 중…',
  unsupported: '이 형식은 미리보기를 만들 수 없어요.',
  unavailable: '쓸 수 없는 사진이에요.',
  reasons: {
    SIZE_TOO_LARGE: '파일이 너무 커요.',
    UNSUPPORTED_CONTENT_TYPE: '올릴 수 없는 종류의 파일이에요.',
    UNSUPPORTED_EXTENSION: '올릴 수 없는 종류의 파일이에요.',
    CONTENT_MISMATCH: '파일 내용이 종류와 달라요. 쓸 수 없는 파일이에요.',
    UNRECOGNIZED_CONTENT: '무슨 파일인지 알 수 없어요.',
    IMAGE_TOO_LARGE: '사진의 픽셀 수가 너무 많아요.',
    INSPECTION_REJECTED: '쓸 수 없는 파일이에요.',
  },
  rejected: '쓸 수 없는 파일이에요.',
  failed: '올리지 못했어요. 다시 시도해 주세요.',
  limitReached: (max) => `최대 ${max}장까지 올릴 수 있어요.`,
}
