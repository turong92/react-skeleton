import type { FailReason } from './videoView'

/** `VideoPlayer` 의 화면 문구 - 기본은 영어, `koVideoPlayerLabels` 는 한국어. 일부만 덮을 때는 `{ ...defaultVideoPlayerLabels, … }` */
export type VideoPlayerLabels = {
  /** 재생 단추의 낭독 이름 - `time` 은 `1:02` 꼴 */
  play: (time: string) => string
  /** `<video>` 의 낭독 이름 */
  video: string
  /** 틀 수 있는 판이 아직 없다(호환 단 준비 중) */
  preparing: string
  /** 이 브라우저는 HLS 도 MSE 도 없다 */
  unsupported: string
  /** 틀어 보다가 모든 판이 실패했다 */
  failed: string
  /** 화질 칩의 낭독 이름 앞머리 */
  quality: string
  auto: string
  original: string
  /** 칩 목록에서 아직 없는 720p 옆에 */
  qualityPreparing: string
}

/** `VideoUploadField` 의 화면 문구 */
export type VideoUploadLabels = {
  title: string
  hint?: string
  chooseButton: string
  /** 서버 목록의 n번째 영상 이름 */
  videoName: (n: number) => string
  /** 올리는 중 진행률 막대의 낭독 이름 */
  uploading: (name: string) => string
  /** 서버가 준비하는 중(진행률 모를 때) */
  processing: string
  processingPercent: (percent: number) => string
  /** 준비 중 진행률 막대의 낭독 이름 */
  processingBar: (name: string) => string
  ready: string
  /** 재생은 되지만 호환 · 사다리 판을 만드는 중 */
  extras: string
  /** 올리다 만 채 남은 줄 */
  abandoned: string
  remove: string
  removeNamed: (name: string) => string
  /** 올리는 중인 줄의 지우기 */
  cancel: string
  cancelNamed: (name: string) => string
  /** 서버가 붙인 실패 사유별 문구 */
  failReasons: Record<FailReason, string>
  errors: {
    unsupportedFile: string
    tooLarge: string
    quota: string
    network: string
    failed: string
    removeFailed: string
  }
  limitReached: (max: number) => string
}

export const defaultVideoPlayerLabels: VideoPlayerLabels = {
  play: (time) => `Play video, ${time}`,
  video: 'Video',
  preparing: 'Getting your video ready. Please check back soon.',
  unsupported: 'This browser cannot play this video.',
  failed: 'The video could not be played. Please try again.',
  quality: 'Quality',
  auto: 'Auto',
  original: 'Original',
  qualityPreparing: 'Preparing',
}

export const koVideoPlayerLabels: VideoPlayerLabels = {
  play: (time) => `영상 재생, ${time}`,
  video: '영상',
  preparing: '영상 준비 중이에요. 잠시 뒤에 다시 와 주세요.',
  unsupported: '이 브라우저에서는 재생할 수 없어요.',
  failed: '영상을 재생하지 못했어요. 다시 눌러 주세요.',
  quality: '화질',
  auto: '자동',
  original: '원본',
  qualityPreparing: '준비 중',
}

export const defaultVideoUploadLabels: VideoUploadLabels = {
  title: 'Add a video',
  hint: 'Drag a file here or choose it. MP4 or MOV.',
  chooseButton: 'Choose a video',
  videoName: (n) => `Video ${n}`,
  uploading: (name) => `Uploading ${name}`,
  processing: 'Preparing…',
  processingPercent: (percent) => `Preparing ${percent}%`,
  processingBar: (name) => `Preparing ${name}`,
  ready: 'Ready to play',
  extras: 'Preparing a version for other devices',
  abandoned: 'This upload was interrupted. Remove it and choose the file again.',
  remove: 'Remove',
  removeNamed: (name) => `Remove ${name}`,
  cancel: 'Cancel',
  cancelNamed: (name) => `Cancel uploading ${name}`,
  failReasons: {
    UNSUPPORTED_FORMAT: 'This video format is not supported.',
    CORRUPT: 'The file is damaged and could not be processed.',
    LIMITS_EXCEEDED: 'The video is longer or larger than the allowed limits.',
    TOO_BIG_FOR_WORKER: 'The video is too large to process.',
    PROCESSING_FAILED: 'The video could not be processed. Please try another file.',
    LEASE_EXPIRED: 'Processing took too long. Please upload the video again.',
    UPLOAD_ABANDONED: 'The upload was interrupted and cleaned up. Please upload the video again.',
  },
  errors: {
    unsupportedFile: 'Only MP4 or MOV videos can be uploaded.',
    tooLarge: 'The file is too large.',
    quota: 'There is not enough space left.',
    network: 'Upload failed. Check your connection and try again.',
    failed: 'Could not upload the video. Please try again.',
    removeFailed: 'Could not remove the video. Please try again.',
  },
  limitReached: (max) => `You can add up to ${max}.`,
}

export const koVideoUploadLabels: VideoUploadLabels = {
  title: '영상 추가',
  hint: '파일을 끌어다 놓거나 골라 주세요. MP4 · MOV.',
  chooseButton: '영상 고르기',
  videoName: (n) => `영상 ${n}`,
  uploading: (name) => `${name} 올리는 중`,
  processing: '준비하는 중…',
  processingPercent: (percent) => `준비 중 ${percent}%`,
  processingBar: (name) => `${name} 준비 중`,
  ready: '재생할 수 있어요',
  extras: '다른 기기용 판 준비 중',
  abandoned: '올리다 만 영상이에요. 지우고 파일을 다시 골라 주세요.',
  remove: '지우기',
  removeNamed: (name) => `${name} 지우기`,
  cancel: '취소',
  cancelNamed: (name) => `${name} 올리기 취소`,
  failReasons: {
    UNSUPPORTED_FORMAT: '지원하지 않는 영상 형식이에요.',
    CORRUPT: '파일이 손상되어 처리할 수 없었어요.',
    LIMITS_EXCEEDED: '허용 길이나 크기를 넘는 영상이에요.',
    TOO_BIG_FOR_WORKER: '영상이 너무 커서 처리할 수 없었어요.',
    PROCESSING_FAILED: '영상을 처리하지 못했어요. 다른 파일로 시도해 주세요.',
    LEASE_EXPIRED: '처리가 너무 오래 걸렸어요. 영상을 다시 올려 주세요.',
    UPLOAD_ABANDONED: '올리다 멈춰서 정리됐어요. 영상을 다시 올려 주세요.',
  },
  errors: {
    unsupportedFile: 'MP4 나 MOV 영상만 올릴 수 있어요.',
    tooLarge: '파일이 너무 커요.',
    quota: '남은 용량이 부족해요.',
    network: '올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
    failed: '영상을 올리지 못했어요. 다시 시도해 주세요.',
    removeFailed: '영상을 지우지 못했어요. 다시 시도해 주세요.',
  },
  limitReached: (max) => `최대 ${max}개까지 올릴 수 있어요.`,
}
