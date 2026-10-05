import { createElement, type ComponentType } from 'react'

/*
 * tests/ssr.safety.test.ts 가 쓰는 「최소한의 올바른 props」 표. 패키지 소스를 정적으로 import 하지 않는다(찍어 낸 프로젝트에는
 * 지워진 패키지가 있다) — 값은 테스트가 불러 준 모듈 이름공간(`ctx.mod('ui')`)에서 꺼낸다.
 * 키는 `<패키지 폴더>#<export 이름>`(스코프를 적지 않는다 — `--scope` 로 바꿔도 그대로). 새 컴포넌트 · 훅을 export 하면 여기 한 줄을 더해야 테스트가 통과한다(잊을 수 없다).
 */
type Mod = Record<string, unknown>
export type FixtureContext = { mod(pkg: string): Mod }

const noop = () => undefined
const call = (fn: unknown, ...args: unknown[]): unknown =>
  (fn as (...a: unknown[]) => unknown)(...args)
const Component = (value: unknown) => value as ComponentType<Record<string, unknown>>

const pageOf = <T>(values: T[]) => ({
  values,
  pagination: {
    page: 0,
    size: 10,
    totalElements: values.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  },
  meta: { timestamp: '2026-01-01T00:00:00Z' },
})
export const fakeNotificationsApi = () => ({
  list: async () => pageOf([]),
  markRead: async (eventId: string) => ({ eventId, readAt: '2026-01-01T00:00:00Z' }),
  markAllRead: async () => ({ updated: 0 }),
})
const notification = {
  id: 'u1:e1',
  eventId: 'e1',
  recipientId: 'u1',
  topic: 'demo',
  type: 'demo.created',
  severity: 'INFO',
  title: 'Hello',
  message: 'A message',
  payload: {},
  createdAt: '2026-01-01T00:00:00Z',
  readAt: null,
}
export const fakeUploader = () => ({
  upload: async (file: { name: string }) => ({
    key: file.name,
    publicUrl: null,
    etag: null,
    multipart: false,
  }),
})
/** 게시판 api — 서버 렌더에서는 아무것도 부르지 않는다(쿼리는 브라우저에서 가져온다) */
const fakeBoardApi = () =>
  new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error('unused in the server render')
      },
    },
  )
const boardConfig = {
  reactionTypes: ['LIKE', 'EMPATHY'],
  reactionMode: 'SINGLE',
  maxCommentDepth: 2,
  titleMaxLength: 80,
  bodyMaxLength: 2000,
  commentMaxLength: 300,
  maxPageSize: 50,
  canModerate: false,
}
const boardPost = {
  id: 'p1',
  boardCode: 'free',
  authorId: 'u1',
  title: 'Hello board',
  excerpt: 'first',
  status: 'PUBLISHED',
  pinned: true,
  viewCount: 3,
  commentCount: 1,
  reactionCounts: { LIKE: 2 },
  myReactions: ['LIKE'],
  attachmentCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}
const boardComment = {
  id: 'c1',
  postId: 'p1',
  parentId: null,
  rootId: 'c1',
  depth: 0,
  authorId: 'u1',
  body: 'First comment',
  status: 'PUBLISHED',
  reactionCounts: {},
  myReactions: [],
  replyCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}
export const fakeI18n = ({ mod }: FixtureContext) =>
  call(mod('i18n').createI18n, {
    catalogs: { ko: { hello: '안녕' }, en: { hello: 'Hello' } },
    defaultLocale: 'ko',
    storageKey: 'ssr-fixture:locale',
  })
export function fakeSession({ mod }: FixtureContext) {
  const auth = mod('auth')
  const unused = async () => {
    throw new Error('unused')
  }
  return call(auth.createAuthSession, {
    api: { login: unused, socialLogin: unused, me: unused },
    store: call(auth.createTokenStore),
  })
}

/** 컴포넌트 — 서버에서 그려 본다. props 는 호출 때 만든다(호출마다 새 객체) */
export const COMPONENT_PROPS: Record<string, (ctx: FixtureContext) => Record<string, unknown>> = {
  'ui#Button': () => ({ children: 'Save' }),
  'ui#Input': () => ({ 'aria-label': 'Name' }),
  'ui#Field': (ctx) => ({
    label: 'Email',
    hint: 'We never share it',
    error: 'Required',
    children: (control: Record<string, unknown>) =>
      createElement(Component(ctx.mod('ui').Input), control),
  }),
  'ui#Select': () => ({
    'aria-label': 'Choice',
    children: createElement('option', { value: 'a' }, 'A'),
  }),
  'ui#Textarea': () => ({ 'aria-label': 'Message' }),
  'ui#Checkbox': () => ({ label: 'Agree', indeterminate: true }),
  'ui#Switch': () => ({ label: 'Notify me' }),
  'ui#Tabs': () => ({
    'aria-label': 'Sections',
    items: [
      { id: 'a', label: 'A', content: 'first' },
      { id: 'b', label: 'B', content: 'second' },
    ],
  }),
  'ui#Table': () => ({
    caption: 'People',
    columns: [{ key: 'n', header: 'Name', render: (row: { n: string }) => row.n }],
    rows: [{ n: 'Ada' }],
    rowKey: (row: { n: string }) => row.n,
  }),
  'ui#Pagination': () => ({ page: 2, totalPages: 9, onPageChange: noop }),
  'ui#EmptyState': () => ({ title: 'Nothing here', description: 'Add one' }),
  'ui#Card': () => ({ title: 'Card', children: 'body' }),
  'ui#Dialog': () => ({ open: true, onClose: noop, title: 'Dialog', children: 'body' }),
  'ui#Spinner': () => ({}),
  'ui#AppShell': () => ({
    brand: 'brand',
    nav: 'nav',
    actions: 'actions',
    children: 'page',
  }),
  'ui#ErrorBoundary': () => ({ children: 'safe' }),
  'ui#PageHeader': () => ({ title: 'Notes', description: 'All of them', actions: 'actions' }),
  'ui#Badge': () => ({ children: 'Draft' }),
  'ui#Progress': () => ({ label: 'Uploading', value: 0.5, valueText: '50%' }),
  'ui#FilePicker': () => ({ title: 'Attach a file', buttonLabel: 'Choose file', onFiles: noop }),
  'ui#Stat': () => ({ label: 'Notes', value: 3, hint: 'so far' }),
  'ui#SwitchRow': () => ({
    title: 'Email',
    description: 'A weekly summary',
    checked: true,
    onChange: noop,
  }),
  'ui#SectionCard': () => ({
    id: 'profile',
    title: 'Profile',
    collapsible: true,
    children: 'body',
  }),
  'ui#SectionIndex': () => ({
    label: 'On this page',
    items: [{ id: 'profile', label: 'Profile' }],
  }),
  'ui#RowMenu': () => ({ label: 'More', items: [{ key: 'edit', label: 'Edit', onSelect: noop }] }),
  'ui#ErrorReference': () => ({ reference: 'trace-1' }),
  'ui#LanguageMenu': () => ({
    label: 'Language',
    value: 'en',
    options: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
    onChange: noop,
  }),
  'ui#Skeleton': () => ({ lines: 2, label: 'Loading' }),
  'ui#Avatar': () => ({ name: 'Ada Lovelace', src: '/ada.png' }),
  'ui#Breadcrumbs': () => ({
    label: 'Breadcrumb',
    items: [{ label: 'Home', href: '/' }, { label: 'Notes' }],
  }),
  'ui#Alert': () => ({ tone: 'warning', title: 'Heads up', children: 'Details' }),
  'ui#CopyButton': () => ({ value: 'abc', label: 'Copy' }),
  'ui#Stepper': () => ({
    label: 'Progress',
    current: 1,
    steps: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
  }),
  'ui#Tooltip': () => ({
    content: 'Hint',
    children: (aria: Record<string, unknown>) => createElement('button', aria, 'Help'),
  }),
  'i18n#I18nProvider': (ctx) => ({ i18n: fakeI18n(ctx), children: 'inside' }),
  'theme#ThemeToggle': () => ({}),
  'theme#ThemedToaster': () => ({}),
  'auth#AuthProvider': (ctx) => ({ session: fakeSession(ctx), children: 'inside' }),
  'auth#RequireAuth': () => ({ children: 'secret' }),
  'notifications#NotificationBell': () => ({ api: fakeNotificationsApi() }),
  'notifications#NotificationList': () => ({ items: [notification] }),
  'board#ReactionBar': () => ({
    types: ['LIKE', 'EMPATHY'],
    counts: { LIKE: 2 },
    mine: ['LIKE'],
    onToggle: noop,
    labels: { EMPATHY: '공감' },
    icons: { LIKE: '👍' },
  }),
  'board#PostList': () => ({
    posts: [boardPost],
    page: 0,
    totalPages: 2,
    onPageChange: noop,
    sort: 'latest',
    onSortChange: noop,
    query: '',
    onSearch: noop,
  }),
  'board#PostDetail': () => ({
    post: { ...boardPost, body: 'Body', attachments: [] },
    onEdit: noop,
  }),
  'board#PostEditor': () => ({
    limits: { titleMaxLength: 80, bodyMaxLength: 2000 },
    onSubmit: noop,
  }),
  'board#CommentThread': () => ({
    thread: {
      ...boardComment,
      replies: [{ ...boardComment, id: 'c2', parentId: 'c1', depth: 1, body: 'A reply' }],
    },
    maxDepth: 2,
    commentMaxLength: 300,
    reactionTypes: ['LIKE'],
    onReply: noop,
  }),
  'board#BoardComments': () => ({
    api: fakeBoardApi(),
    boardCode: 'free',
    postId: 'p1',
    config: boardConfig,
  }),
  'board#PostReactionBar': () => ({
    api: fakeBoardApi(),
    boardCode: 'free',
    post: boardPost,
    config: boardConfig,
  }),
  'captcha-turnstile#Turnstile': () => ({ siteKey: 'site-key', onToken: noop }),
}

/** 훅 — 작은 컴포넌트 안에서 이 인자로 불러 본다 */
export const HOOK_ARGS: Record<string, (ctx: FixtureContext) => unknown[]> = {
  'theme#useTheme': () => [],
  'auth#useAuth': () => [],
  'auth#useSocialLoginCallback': () => [{ complete: () => new Promise(noop) }, '?code=x'],
  'captcha-turnstile#useTurnstileToken': () => [],
  'notifications#useNotifications': () => [fakeNotificationsApi()],
  'notifications#useUnreadCount': () => [fakeNotificationsApi()],
  'notifications#useMarkRead': () => [fakeNotificationsApi()],
  'notifications#useMarkAllRead': () => [fakeNotificationsApi()],
  'notifications#useNotificationIngest': () => [],
  'board#useBoardConfig': () => [fakeBoardApi()],
  'board#useBoards': () => [fakeBoardApi()],
  'board#useBoard': () => [fakeBoardApi(), 'free'],
  'board#usePosts': () => [fakeBoardApi(), 'free'],
  'board#usePost': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useComments': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useCreatePost': () => [fakeBoardApi(), 'free'],
  'board#useUpdatePost': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useModeratePost': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useRemovePost': () => [fakeBoardApi(), 'free'],
  'board#useCreateComment': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useUpdateComment': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useRemoveComment': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useModerateComment': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useReaction': () => [fakeBoardApi(), 'free', 'SINGLE'],
  'i18n#useT': (ctx) => [fakeI18n(ctx)],
  'realtime#useSseClient': () => [{ url: '/api/v1/notifications/sse' }],
  'realtime#useNotificationSocket': () => [
    { url: 'ws://localhost/ws', topic: 'demo', getAccessToken: () => null },
  ],
  'storage#useUpload': () => [fakeUploader()],
}

/**
 * 일부러 브라우저 전용인 export — 서버에서 그리지 않는다. 항목마다 이유를 쓴다(이유 없는 항목 · 더는 없는 export 는 테스트가 막는다).
 * 지금은 없다: 모든 컴포넌트 · 훅이 서버에서 그려진다(브라우저 API 는 effect · 이벤트 핸들러 안에서만).
 */
export const BROWSER_ONLY: Record<string, string> = {}
