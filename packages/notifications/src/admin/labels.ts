import type { BroadcastStatus } from './types'

/** 공지 운영 화면의 모든 글자 - 앱이 `Partial` 로 덮어쓴다(번역은 앱의 몫, 부품은 i18n 을 모른다) */
export type BroadcastAdminLabels = {
  loading: string
  loadFailed: string
  retry: string
  cancel: string
  close: string
  edit: string
  remove: string
  /** 상태 칩 */
  status: Record<BroadcastStatus, string>
  /** 대상 종류 이름(서버의 `kind`) - 없는 종류는 `kind` 그대로 */
  audienceKinds: Record<string, string>
  /** 채널 이름(서버의 채널 키) - 없는 채널은 키 그대로 */
  channelNames: Record<string, string>
  errors: {
    notFound: string
    /** `BROADCAST.INVALID_STATE` - 이미 보냈거나 상태가 바뀌었다 */
    invalidState: string
    unknownType: string
    unknownChannel: string
    unknownAudience: string
    invalidAudience: string
    invalidLink: string
    invalidSchedule: string
    testTooSoon: string
    validation: string
    forbidden: string
    notEnabled: string
    generic: string
  }
  list: {
    title: string
    caption: string
    create: string
    empty: string
    loadMore: string
    filter: string
    allStatuses: string
    columns: {
      title: string
      type: string
      audience: string
      status: string
      when: string
      progress: string
      actions: string
    }
    immediate: string
    open: string
    openTitle: (title: string) => string
    progress: string
    progressText: (recipients: number, estimate: number | null) => string
  }
  editor: {
    createTitle: string
    editTitle: string
    notEditable: string
    noPermission: string
    type: string
    advertisingNotice: string
    title: string
    body: string
    bodyCount: (length: number, max: number) => string
    link: string
    linkHint: string
    audience: string
    audienceKind: string
    audienceParam: Record<'ROLE' | 'WORKSPACE' | 'TEXT', string>
    audienceCount: (count: number) => string
    audienceCountLoading: string
    audienceCountFailed: string
    channels: string
    inboxAlways: string
    pushLocked: string
    when: string
    now: string
    schedule: string
    scheduledAt: string
    scheduledAtHint: (timeZone: string) => string
    nightWarning: string
    problems: {
      title: string
      audienceParam: string
      link: string
      scheduledAt: string
    }
    saveDraft: string
    saved: string
    test: string
    testSent: string
    testAdvertising: string
    send: string
    sendScheduled: string
  }
  confirm: {
    sendTitle: string
    scheduleTitle: string
    audience: string
    channels: string
    when: string
    sendConfirm: (count: number) => string
    scheduleConfirm: (count: number) => string
    cancelTitle: string
    cancelBody: string
    cancelConfirm: string
    keep: string
    deleteTitle: string
    deleteBody: string
    deleteConfirm: string
    unscheduleTitle: string
    unscheduleBody: string
    unscheduleConfirm: string
  }
  detail: {
    unschedule: string
    cancel: string
    resume: string
    failedBanner: (reason: string | null) => string
    stats: {
      title: string
      estimate: string
      recipients: string
      inboxStored: string
      inboxRead: string
      readRate: (percent: string) => string
      pushQueued: string
      pushDelivered: string
      pushFailed: string
      pushDropped: string
      pushOpened: string
      clickRate: (percent: string) => string
      unknown: string
    }
    history: {
      title: string
      createdBy: string
      sentBy: string
      cancelledBy: string
      scheduledAt: string
      sendRequestedAt: string
      startedAt: string
      finishedAt: string
      cancelledAt: string
      createdAt: string
      none: string
    }
    content: { type: string; audience: string; channels: string; link: string; body: string }
  }
}
