import type { WorkspaceLabels } from './labels'

/** 한국어 문구 */
export const koWorkspaceLabels: WorkspaceLabels = {
  loading: '불러오는 중',
  loadFailed: '불러오지 못했어요. 다시 시도해 주세요.',
  retry: '다시 시도',
  cancel: '취소',
  close: '닫기',
  roles: { OWNER: '소유자', ADMIN: '관리자', MEMBER: '멤버' },
  notFound: {
    title: '워크스페이스를 찾을 수 없어요',
    description:
      '없는 워크스페이스이거나 멤버가 아니에요. 소유자나 관리자에게 초대를 요청해 주세요.',
  },
  form: {
    nameLabel: '워크스페이스 이름',
    nameRequired: '이름을 입력해 주세요.',
    nameTooLong: (max) => `${max}자까지 쓸 수 있어요.`,
    slugLabel: '주소 이름',
    slugHint: '영문 소문자 · 숫자 · 하이픈, 3~40자예요. 웹 주소에 들어가요.',
    slugLength: (min, max) => `${min}~${max}자로 입력해 주세요.`,
    slugFormat: '영문 소문자 · 숫자 · 하이픈만 쓰고, 하이픈으로 시작하거나 끝낼 수 없어요.',
    slugTaken: '이미 쓰고 있는 주소 이름이에요. 다른 이름을 써 주세요.',
    failed: '저장하지 못했어요. 다시 시도해 주세요.',
  },
  switcher: {
    trigger: (currentName) =>
      currentName ? `워크스페이스 바꾸기, 지금: ${currentName}` : '워크스페이스 고르기',
    choose: '워크스페이스 고르기',
    create: '새 워크스페이스',
    loading: '워크스페이스를 불러오는 중',
  },
  create: { title: '워크스페이스 만들기', submit: '워크스페이스 만들기' },
  settings: {
    generalTitle: '워크스페이스',
    readOnlyHint: '이름과 주소는 소유자와 관리자만 바꿀 수 있어요.',
    save: '변경 저장',
    saved: '저장했어요',
    membersTitle: '멤버',
    membersCount: (count) => `${count}명`,
    membersCaption: '워크스페이스 멤버',
    columnMember: '멤버',
    columnRole: '역할',
    columnJoined: '참여한 날',
    columnActions: '동작',
    you: '나',
    unnamedMember: '이름 없는 멤버',
    roleOf: (name) => `${name}의 역할`,
    actionsOf: (name) => `${name} 더보기`,
    removeAction: '워크스페이스에서 내보내기',
    transferAction: '소유권 이전',
    removeDialog: {
      title: (name) => `${name}님을 내보낼까요?`,
      description: (name) =>
        `${name}님은 다음 요청부터 이 워크스페이스에 접근할 수 없어요. 쓴 글은 남아요.`,
      confirm: '내보내기',
    },
    transferDialog: {
      title: '소유권 이전',
      description: (name, workspaceName) =>
        `${name}님이 ${workspaceName}의 소유자가 되고, 나는 관리자가 돼요. 되돌리려면 새 소유자가 다시 이전해야 해요.`,
      confirm: '소유권 이전',
    },
    memberChangeFailed: '멤버를 바꾸지 못했어요. 다시 시도해 주세요.',
    memberGone: '이미 멤버가 아니에요. 목록을 새로 불러왔어요.',
    leave: {
      title: '워크스페이스 나가기',
      description:
        '이 워크스페이스에 접근할 수 없게 돼요. 다시 들어오려면 소유자나 관리자에게 요청하세요.',
      action: '워크스페이스 나가기',
      ownerHint: '내가 소유자예요. 나가기 전에 다른 멤버에게 소유권을 이전해 주세요.',
      dialogTitle: (workspaceName) => `${workspaceName}에서 나갈까요?`,
      dialogDescription: '나가면 바로 접근할 수 없어요.',
      confirm: '나가기',
      ownerCannotLeave: '소유자는 나갈 수 없어요. 먼저 소유권을 이전해 주세요.',
      failed: '나가지 못했어요. 다시 시도해 주세요.',
    },
  },
}
