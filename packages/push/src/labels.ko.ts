import type { PushLabels } from './labels'

/** 한국어 문구 */
export const koPushLabels: PushLabels = {
  loading: '불러오는 중',
  loadFailed: '푸시 설정을 불러오지 못했어요.',
  retry: '다시 시도',
  prompt: {
    title: '이 기기에서 알림 받기',
    description: '푸시 알림을 켜면 이 탭을 닫아 두어도 새 소식을 바로 알려 드려요.',
    enable: '알림 받기',
    later: '나중에',
  },
  settings: {
    switchTitle: '이 기기에서 푸시 받기',
    switchDescription: '이 페이지를 닫아 두어도 알림이 도착해요.',
    enableFailed: '푸시를 켜지 못했어요. 다시 시도해 주세요.',
    disableFailed: '푸시를 끄지 못했어요. 다시 시도해 주세요.',
    denied: {
      title: '이 브라우저에서 알림이 막혀 있어요',
      description:
        '브라우저 설정(주소 옆 자물쇠)에서 이 사이트의 알림을 허용한 뒤, 돌아와서 다시 켜 주세요.',
    },
    needsInstall: {
      title: '먼저 홈 화면에 추가해 주세요',
      description:
        'iPhone · iPad 에서는 설치한 앱에서만 푸시를 받을 수 있어요. 공유 단추의 「홈 화면에 추가」 뒤 거기서 열어 주세요.',
    },
    unsupported: {
      title: '이 브라우저는 푸시 알림을 받을 수 없어요',
      description: '최신 Chrome · Edge · Firefox · Safari 에서 열어 주세요.',
    },
    notConfigured: {
      title: '푸시 알림을 쓸 수 없어요',
      description: '이 서비스는 웹 푸시를 켜 두지 않았어요.',
    },
    test: {
      action: '시험 알림 보내기',
      sent: '시험 알림을 보냈어요.',
      tooSoon: '시험 알림은 1분 뒤에 다시 보낼 수 있어요.',
      failed: '시험 알림을 보내지 못했어요.',
    },
    devices: {
      title: '내 다른 기기',
      caption: '푸시를 받는 기기',
      empty: '다른 기기가 없어요.',
      columnName: '기기',
      columnLastSeen: '마지막으로 본 때',
      columnActions: '동작',
      kind: { WEBPUSH: '웹 브라우저', FCM: '모바일 앱' },
      remove: '지우기',
      removeFor: (name) => `${name} 지우기`,
      removeFailed: '기기를 지우지 못했어요.',
    },
    types: {
      title: '푸시로 받을 알림',
      description: '끄면 푸시만 멈춰요. 알림함에는 그대로 쌓여요.',
      empty: '설정할 알림 종류가 없어요.',
      allMuted: '알림이 전체 꺼져 있어요.',
      saveFailed: '변경을 저장하지 못했어요.',
      names: {},
    },
  },
}
