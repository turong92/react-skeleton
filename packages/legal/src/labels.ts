import type { ConsentState } from './types'

/** 이 패키지가 그리는 모든 문구 — 부품은 번역을 모른다. 앱이 `Partial<LegalLabels>` 를 넘긴다(한국어: `koLegalLabels`) */
export type LegalLabels = {
  // 체크리스트
  agreeAll: string
  required: string
  optional: string
  /** 줄 옆 「보기」 버튼의 이름 — 문서 제목을 넣어 낭독기가 어느 것인지 알게 한다 */
  view: (title: string) => string
  viewShort: string
  requiredError: string
  loadingDocuments: string
  documentsFailed: string
  retry: string
  /** 샘플(템플릿) 문서 표시 */
  sampleText: string
  // 문서
  close: string
  version: (version: string) => string
  effective: (date: string) => string
  switcher: string
  olderNotice: (currentVersion: string) => string
  viewCurrent: string
  upcomingNotice: (version: string, date: string) => string
  /** 요청한 언어가 이 판에 없어 다른 언어로 보여 준다 */
  otherLanguage: (locale: string) => string
  documentFailed: string
  newTab: string
  // 재동의
  reconsentTitle: string
  reconsentBody: string
  reconsentBodyFirstSignIn: string
  reconsentSubmit: string
  reconsentLeave: string
  /** 409 `LEGAL.VERSION_STALE` — 그 사이 새 판이 나왔다 */
  reconsentStale: string
  reconsentFailed: string
  submitting: string
  // 설정
  settingsTitle: string
  settingsDescription: string
  state: Record<ConsentState, string>
  agreedAt: (version: string, date: string) => string
  graceUntil: (date: string) => string
  neverAgreed: string
  agree: string
  withdraw: string
  /** 필수 동의는 철회할 수 없다(방법은 계정 삭제) */
  cannotWithdraw: string
  history: string
  historyEmpty: string
  historyAction: { AGREED: string; WITHDRAWN: string }
  historyColumns: { when: string; document: string; action: string; version: string }
  settingsFailed: string
  withdrawFailed: string
  /** 선택 동의를 마케팅처럼 바꿨다 */
  saved: string
}

export const defaultLegalLabels: LegalLabels = {
  agreeAll: 'Agree to all',
  required: 'Required',
  optional: 'Optional',
  view: (title) => `View ${title}`,
  viewShort: 'View',
  requiredError: 'Please agree to the required items to continue.',
  loadingDocuments: 'Loading the agreements',
  documentsFailed: 'We could not load the agreements.',
  retry: 'Try again',
  sampleText: 'Sample text — not reviewed legal wording.',
  close: 'Close',
  version: (version) => `Version ${version}`,
  effective: (date) => `Effective ${date}`,
  switcher: 'Version',
  olderNotice: (current) =>
    `You are reading an older version. Version ${current} is the one in effect.`,
  viewCurrent: 'Read the current version',
  upcomingNotice: (version, date) => `Version ${version} takes effect on ${date}.`,
  otherLanguage: (locale) => `Shown in the document's default language (${locale}).`,
  documentFailed: 'We could not load this document.',
  newTab: '(opens in a new tab)',
  reconsentTitle: 'Our terms have changed',
  reconsentBody: 'Please read and agree to the updated documents to keep using the service.',
  reconsentBodyFirstSignIn: 'Before you continue, please read and agree to these documents.',
  reconsentSubmit: 'Agree and continue',
  reconsentLeave: 'Sign out',
  reconsentStale:
    'A newer version was just published. Please read the updated text and agree again.',
  reconsentFailed: 'We could not save your agreement. Try again.',
  submitting: 'Saving',
  settingsTitle: 'Agreements',
  settingsDescription: 'The documents you agreed to, and your choices for optional ones.',
  state: {
    CURRENT: 'Agreed',
    GRACE: 'Update coming',
    OUTDATED: 'Needs your agreement',
    MISSING: 'Not agreed',
    WITHDRAWN: 'Withdrawn',
  },
  agreedAt: (version, date) => `Version ${version} · agreed ${date}`,
  graceUntil: (date) => `Please agree to the new version by ${date}.`,
  neverAgreed: 'You have not agreed to this yet.',
  agree: 'Agree',
  withdraw: 'Withdraw',
  cannotWithdraw: 'Required to use the service. To withdraw, delete your account.',
  history: 'History',
  historyEmpty: 'Nothing recorded yet.',
  historyAction: { AGREED: 'Agreed', WITHDRAWN: 'Withdrawn' },
  historyColumns: { when: 'When', document: 'Document', action: 'Action', version: 'Version' },
  settingsFailed: 'We could not load your agreements.',
  withdrawFailed: 'We could not change this. Try again.',
  saved: 'Saved',
}

export function mergeLegalLabels(labels?: Partial<LegalLabels>): LegalLabels {
  return { ...defaultLegalLabels, ...labels }
}

/** 한국어 문구 — 앱이 `labels={koLegalLabels}` 로 넘긴다 */
export const koLegalLabels: LegalLabels = {
  agreeAll: '전체 동의',
  required: '필수',
  optional: '선택',
  view: (title) => `${title} 보기`,
  viewShort: '보기',
  requiredError: '필수 항목에 동의해 주세요.',
  loadingDocuments: '약관을 불러오는 중',
  documentsFailed: '약관을 불러오지 못했어요.',
  retry: '다시 시도',
  sampleText: '샘플 문서예요 — 법률 검토를 마친 문구가 아니에요.',
  close: '닫기',
  version: (version) => `${version} 판`,
  effective: (date) => `${date} 시행`,
  switcher: '판',
  olderNotice: (current) => `지난 판을 보고 있어요. 지금 효력이 있는 판은 ${current} 판이에요.`,
  viewCurrent: '현재 판 보기',
  upcomingNotice: (version, date) => `${version} 판은 ${date}에 시행돼요.`,
  otherLanguage: (locale) => `이 언어의 문서가 없어 기본 언어(${locale})로 보여 드려요.`,
  documentFailed: '문서를 불러오지 못했어요.',
  newTab: '(새 탭에서 열림)',
  reconsentTitle: '약관이 바뀌었어요',
  reconsentBody: '계속 이용하려면 바뀐 문서를 읽고 동의해 주세요.',
  reconsentBodyFirstSignIn: '계속하기 전에 아래 문서를 읽고 동의해 주세요.',
  reconsentSubmit: '동의하고 계속하기',
  reconsentLeave: '로그아웃',
  reconsentStale: '방금 새 판이 나왔어요. 바뀐 내용을 읽고 다시 동의해 주세요.',
  reconsentFailed: '동의를 저장하지 못했어요. 다시 시도해 주세요.',
  submitting: '저장하는 중',
  settingsTitle: '약관 동의',
  settingsDescription: '동의한 문서와, 선택 항목의 동의 여부를 관리해요.',
  state: {
    CURRENT: '동의함',
    GRACE: '개정 예정',
    OUTDATED: '다시 동의 필요',
    MISSING: '동의 안 함',
    WITHDRAWN: '철회함',
  },
  agreedAt: (version, date) => `${version} 판 · ${date} 동의`,
  graceUntil: (date) => `${date}까지 새 판에 동의해 주세요.`,
  neverAgreed: '아직 동의하지 않았어요.',
  agree: '동의',
  withdraw: '철회',
  cannotWithdraw: '서비스 이용에 필요한 동의예요. 철회하려면 계정을 삭제해 주세요.',
  history: '동의 이력',
  historyEmpty: '아직 기록이 없어요.',
  historyAction: { AGREED: '동의', WITHDRAWN: '철회' },
  historyColumns: { when: '일시', document: '문서', action: '내용', version: '판' },
  settingsFailed: '동의 내역을 불러오지 못했어요.',
  withdrawFailed: '바꾸지 못했어요. 다시 시도해 주세요.',
  saved: '저장했어요',
}
