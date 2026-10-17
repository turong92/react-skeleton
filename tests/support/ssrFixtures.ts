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
const paymentOrder = {
  id: 'ord_1',
  status: 'PAID',
  kind: 'ONE_TIME',
  itemType: 'cheer',
  itemRef: 'cheer-3000',
  quantity: 1,
  orderName: 'Cheer 3,000',
  amount: { amount: 3000, currency: 'KRW' },
  refundedAmount: 0,
  refundableAmount: 3000,
  refundPending: false,
  method: 'CARD',
  card: { issuer: 'HYUNDAI', last4: '1234' },
  testMode: true,
  failureCode: null,
  createdAt: '2026-01-01T00:00:00Z',
  paidAt: '2026-01-01T00:00:00Z',
  fulfilled: true,
}
export const fakePaymentLedgerApi = () => ({
  config: async () => ({ available: true, testMode: true, refundRequestsEnabled: true }),
  createOrder: async () => ({ order: paymentOrder, checkout: {} }),
  confirmOrder: async () => paymentOrder,
  abandonOrder: async () => paymentOrder,
  getOrder: async () => ({ order: paymentOrder, refunds: [] }),
  listOrders: async () => ({
    values: [paymentOrder],
    cursor: { hasNext: false },
    meta: { timestamp: '2026-01-01T00:00:00Z' },
  }),
  requestRefund: async () => ({}),
  withdrawRefund: async () => ({}),
})
const paymentSubscription = {
  id: 'sub_1',
  status: 'ACTIVE',
  planCode: 'basic',
  planName: 'Basic',
  amount: { amount: 3900, currency: 'KRW' },
  period: 'P1M',
  currentPeriodStart: '2026-01-01T00:00:00Z',
  currentPeriodEnd: '2026-02-01T00:00:00Z',
  attempt: 1,
  endReason: null,
  card: { issuer: 'HYUNDAI', last4: '1234' },
  pendingPlanCode: null,
  testMode: true,
  createdAt: '2026-01-01T00:00:00Z',
}
export const fakeSubscriptionApi = () => ({
  plans: async () => [
    {
      code: 'basic',
      name: 'Basic',
      amount: { amount: 3900, currency: 'KRW' },
      period: 'P1M',
      level: 1,
    },
  ],
  start: async () => ({
    subscription: { ...paymentSubscription, status: 'PENDING' },
    billingAuth: null,
  }),
  activate: async () => paymentSubscription,
  me: async () => ({ subscription: paymentSubscription, orders: [paymentOrder] }),
  cancel: async () => paymentSubscription,
  cancelPreview: async () => ({
    open: true,
    refund: { amount: 3393, currency: 'KRW' },
    withdrawal: false,
    lines: [],
  }),
  cancelNow: async () => ({
    subscription: paymentSubscription,
    refund: { amount: 0, currency: 'KRW' },
    withdrawal: false,
    lines: [],
    refunds: [],
  }),
  changePreview: async () => ({
    planCode: 'pro',
    planName: 'Pro',
    charge: { amount: 1500, currency: 'KRW' },
    amount: { amount: 9900, currency: 'KRW' },
    period: 'P1M',
    restartsPeriod: false,
  }),
  changePlan: async () => paymentSubscription,
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
/** 작성자 프로필 api — 서버 렌더에서는 아무것도 부르지 않는다 */
const fakeAuthorProfileApi = () =>
  new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error('unused in the server render')
      },
    },
  )
const authorProfile = { id: 'prf_a', name: 'Ann', tag: '0001', createdAt: '2026-01-01T00:00:00Z' }
const authorPickerSlot = {
  boardCode: 'free',
  value: undefined,
  onChange: noop,
  threadAuthorId: undefined,
  threadLoading: false,
  invalid: false,
  disabled: false,
  onUnsettledChange: noop,
}
const fakeLegalApi = () =>
  new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error('unused in the server render')
      },
    },
  )
const legalRow = {
  type: 'terms',
  version: '2026-10-01',
  locale: 'ko',
  title: '이용약관',
  kind: 'required',
  template: false,
}
const legalController = (ctx: FixtureContext) =>
  call(ctx.mod('legal').createReconsentController, { api: fakeLegalApi() })
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
    api: {
      login: unused,
      socialLogin: unused,
      me: unused,
      refresh: unused,
      logout: unused,
      magicLinkRequest: unused,
      magicLinkRedeem: unused,
    },
    store: call(auth.createTokenStore),
  })
}

const pending = () => new Promise<never>(noop)
/** 부르면 끝나지 않는 약속을 돌려주는 계정 API — 서버에서는 「불러오는 중」까지만 그려진다 */
const fakeAccountApi = () => new Proxy({}, { get: () => pending })
const authLabels = ({ mod }: FixtureContext) => mod('auth').defaultAuthLabels
/** 다시 인증의 종류를 고르는 `me` 의 부분 — 비밀번호가 있는 계정 */
const authSubject = { hasPassword: true, email: 'a@example.com', providers: [] }
const authPolicy = {
  minLength: 10,
  maxBytes: 72,
  requireLetter: true,
  requireDigit: true,
  requireSymbol: false,
  forbidEmailLocalPart: true,
}
const asyncNoop = async () => undefined

/** 컴포넌트 — 서버에서 그려 본다. props 는 호출 때 만든다(호출마다 새 객체) */
export const COMPONENT_PROPS: Record<string, (ctx: FixtureContext) => Record<string, unknown>> = {
  'ui#Button': () => ({ children: 'Save' }),
  'ui#Input': () => ({ 'aria-label': 'Name' }),
  'ui#CodeEntry': () => ({
    label: 'Verification code',
    digitLabel: (position: number, total: number) => `Digit ${position} of ${total}`,
    onComplete: () => undefined,
    error: 'Wrong code',
    resend: {
      label: 'Send again',
      onResend: () => undefined,
      secondsLeft: 12,
      waitLabel: (s: number) => `${s}s`,
    },
  }),
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
  'ui#ChoiceGroup': () => ({
    'aria-label': 'Size',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
    value: 'a',
    onChange: () => undefined,
  }),
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
  'ui#SettingsGroup': () => ({ id: 'account', title: 'Account', children: 'rows' }),
  'ui#SettingsRow': () => ({ label: 'Password', value: 'In use' }),
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
  'ui#FormProblems': () => ({
    title: 'Check these',
    problems: [{ key: 'email', message: 'Enter your email', target: 'email' }],
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
  'ui#ConfirmDialog': () => ({
    open: true,
    onClose: noop,
    onConfirm: noop,
    title: 'Delete',
    typedConfirmation: { phrase: 'delete', label: 'Type delete' },
  }),
  'ui#InfiniteList': () => ({
    items: ['a', 'b'],
    getKey: (item: string) => item,
    renderItem: (item: string) => item,
    hasMore: true,
    onLoadMore: noop,
  }),
  'ui#Combobox': () => ({
    selected: null,
    onSelect: noop,
    options: [{ value: 'a', label: 'Alpha' }],
    placeholder: 'Pick',
  }),
  'ui#DatePicker': () => ({ value: '2026-10-06', onChange: noop, todayLabel: 'Today' }),
  'ui#DateRangePicker': () => ({
    legend: 'Stay',
    startLabel: 'From',
    endLabel: 'To',
    value: { start: '2026-10-06', end: '2026-10-09' },
    onChange: noop,
  }),
  'ui#MarkdownView': () => ({
    source: '# Title\n\nHello {{name}} [link](https://example.com)',
    facts: { name: 'Ada' },
  }),
  'seo#Seo': () => ({ title: 'Pricing', description: 'Plans', canonical: '/pricing' }),
  'seo#SeoProvider': () => ({ defaults: { siteName: 'Notes' }, children: 'inside' }),
  'marketing#Hero': () => ({ title: 'Notes', subtitle: 'Write', primaryAction: 'Go' }),
  'marketing#FeatureGrid': () => ({
    title: 'Why',
    features: [{ id: 'a', title: 'Fast', description: 'Quick' }],
  }),
  'marketing#FaqAccordion': () => ({
    title: 'FAQ',
    exclusive: true,
    items: [{ id: 'q', question: 'Q?', answer: 'A' }],
  }),
  'marketing#Testimonial': () => ({ quote: 'Great', author: 'Ada' }),
  'marketing#CtaBand': () => ({ title: 'Ready?', action: 'Go' }),
  'marketing#SiteFooter': () => ({
    brand: 'Notes',
    columns: [{ title: 'Product', links: [{ label: 'Pricing', href: '/pricing' }] }],
    legalLinks: [{ label: 'Terms', href: '/terms' }],
    copyright: '© 2026',
  }),
  'marketing#PricingTable': () => ({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: { monthly: 0, yearly: 0 },
        features: ['One'],
        ctaLabel: 'Go',
      },
      {
        id: 'pro',
        name: 'Pro',
        price: { monthly: 10, yearly: 96 },
        features: ['Two'],
        ctaLabel: 'Buy',
        highlighted: true,
      },
    ],
    interval: 'yearly',
    onIntervalChange: noop,
    onSelect: noop,
    currency: 'USD',
    locale: 'en-US',
  }),
  'marketing#ConsentBanner': (ctx) => ({
    store: call(ctx.mod('marketing').createConsentStore, {
      categories: ['necessary', 'analytics'],
      version: '1',
    }),
    categories: [{ id: 'necessary', label: 'Necessary', required: true }],
  }),
  'marketing#LegalDocumentPage': () => ({
    title: 'Terms',
    today: '2026-10-06',
    versions: [
      { version: '1', effectiveDate: '2026-01-01', markdown: '# Terms\n\nHello {{name}}' },
    ],
    facts: { name: 'Ada' },
  }),
  'marketing#StatusPage': () => ({ code: '418', title: 'Teapot' }),
  'marketing#NotFoundPage': () => ({}),
  'marketing#ServerErrorPage': () => ({ reference: 'trace-1' }),
  'marketing#MaintenancePage': () => ({
    until: '2026-10-06T15:00:00Z',
    zone: 'Asia/Seoul',
    locale: 'en-US',
  }),
  'i18n#I18nProvider': (ctx) => ({ i18n: fakeI18n(ctx), children: 'inside' }),
  'theme#ThemeToggle': () => ({}),
  'theme#ThemedToaster': () => ({}),
  'auth#AuthProvider': (ctx) => ({ session: fakeSession(ctx), children: 'inside' }),
  'auth#RequireAuth': () => ({ children: 'secret' }),
  'auth#RequireRole': () => ({ roles: ['ADMIN'], children: 'secret' }),
  'auth#CodeClockProvider': () => ({ now: () => 0, children: 'inside' }),
  'auth#AuthLayout': () => ({ title: 'Sign in', children: 'inside' }),
  'auth#SignInScreen': () => ({ onPasswordSignIn: asyncNoop }),
  'auth#SignUpScreen': () => ({
    policy: authPolicy,
    onSignUp: async () => ({ status: 'VERIFICATION_SENT', signUpId: 's' }),
    onVerifyCode: asyncNoop,
  }),
  'auth#VerifyCodePanel': () => ({
    email: 'a@example.com',
    onVerify: asyncNoop,
    onStartOver: noop,
  }),
  'auth#ReauthProof': () => ({ kind: 'password', email: 'a@example.com', onChange: noop }),
  'auth#LegacyLinkNotice': () => ({ signInTo: '/login' }),
  'auth#CheckEmailPanel': () => ({ email: 'a@example.com' }),
  'auth#LoginIdField': (ctx) => ({
    value: 'Sumin',
    onChange: noop,
    check: {
      status: 'checking',
      normalized: 'sumin',
      canSubmit: true,
      showError: false,
      savedAsNormalized: false,
      touch: noop,
    },
    rules: { minLength: 4, maxLength: 20 },
    labels: authLabels(ctx),
  }),
  'auth#LoginIdRetry': (ctx) => ({
    initialValue: 'sumin',
    rules: { minLength: 4, maxLength: 20 },
    api: { checkLoginId: async (id: string) => ({ normalized: id, available: true }) },
    onSubmit: noop,
    labels: authLabels(ctx),
  }),
  'auth#PasswordHints': (ctx) => ({ policy: authPolicy, password: '', labels: authLabels(ctx) }),
  'auth#PasswordField': (ctx) => ({
    label: 'Password',
    value: '',
    onChange: noop,
    labels: authLabels(ctx),
    autoComplete: 'new-password',
  }),
  'auth#SocialButtons': (ctx) => ({
    providers: [{ provider: 'google' }],
    labels: authLabels(ctx),
    onSelect: noop,
  }),
  'auth#TokenLanding': () => ({
    token: 't',
    run: asyncNoop,
    title: 'Verify',
    checking: 'Checking',
    done: 'Done',
    invalidTitle: 'Invalid',
    invalidBody: 'Invalid link',
  }),
  'auth#MagicLinkLanding': () => ({
    token: 't',
    onRedeem: asyncNoop,
    onDone: noop,
    requestTo: '/login',
  }),
  'auth#SocialLinkProofScreen': () => ({
    provider: 'Kakao',
    kind: 'password',
    email: 'a@example.com',
    requestCode: asyncNoop,
    onSubmit: asyncNoop,
    backTo: '/account',
  }),
  'auth#DiscoveryLoading': () => ({}),
  'auth#ForgotPasswordScreen': () => ({ onSubmit: asyncNoop, signInTo: '/login' }),
  'auth#ForgotLoginIdScreen': () => ({ onSubmit: asyncNoop, signInTo: '/login' }),
  'auth#ResetPasswordScreen': () => ({
    token: 't',
    policy: authPolicy,
    onReset: asyncNoop,
    signInTo: '/login',
    forgotTo: '/forgot-password',
  }),
  'auth#SocialCallbackScreen': () => ({ state: { status: 'pending' }, signInTo: '/login' }),
  'auth#DeletionPendingScreen': () => ({
    pending: { purgeAfter: '2026-11-05T00:00:00Z', restoreToken: 't' },
    onCancel: asyncNoop,
    leaveTo: '/login',
  }),
  'auth#AccountStateNotice': () => ({ kind: 'suspended' }),
  'auth#AccountSettings': () => ({
    api: fakeAccountApi(),
    locales: [{ value: 'en', label: 'English' }],
  }),
  'auth#ProfileSection': () => ({
    profile: { displayName: 'Ann', locale: 'en', timeZone: 'UTC' },
    locales: [{ value: 'en', label: 'English' }],
    timeZones: ['UTC'],
    onSave: asyncNoop,
  }),
  'auth#PasswordSection': () => ({
    subject: authSubject,
    policy: authPolicy,
    onChange: asyncNoop,
    requestReauthCode: asyncNoop,
  }),
  'auth#EmailSection': () => ({
    email: 'a@example.com',
    verified: true,
    subject: authSubject,
    requestReauthCode: asyncNoop,
    onChangeEmail: asyncNoop,
    onConfirmCode: asyncNoop,
  }),
  'auth#ContactEmailSection': () => ({
    contactEmail: null,
    onRequestCode: asyncNoop,
    onConfirmCode: asyncNoop,
    onRemove: asyncNoop,
  }),
  'auth#EmailRequiredScreen': () => ({
    onRequestCode: asyncNoop,
    onConfirmCode: asyncNoop,
    onRegistered: noop,
    onSignOut: noop,
    onDelete: noop,
  }),
  'auth#EmailRequiredGate': (ctx) => ({
    controller: call(ctx.mod('auth').createEmailRequiredController),
    api: fakeAccountApi(),
    accountId: null,
    onSignOut: noop,
    onDelete: noop,
    children: createElement('p', null, 'app'),
  }),
  'auth#EmailWriteNotice': (ctx) => ({
    controller: call(ctx.mod('auth').createEmailRequiredController),
  }),
  'auth#LoginIdRequiredScreen': (ctx) => ({
    rules: { minLength: 4, maxLength: 20 },
    api: { checkLoginId: async (id: string) => ({ normalized: id, available: true }) },
    onSubmit: asyncNoop,
    onChosen: noop,
    onAlreadySet: noop,
    onSignOut: noop,
    labels: authLabels(ctx),
  }),
  'auth#LoginIdGate': (ctx) => ({
    controller: call(ctx.mod('auth').createLoginIdRequiredController),
    api: fakeAccountApi(),
    accountId: null,
    onSignOut: noop,
    onDiscarded: noop,
    children: createElement('p', null, 'app'),
  }),
  'auth#SignInMethodsSection': () => ({
    identities: [],
    subject: authSubject,
    requestReauthCode: asyncNoop,
    onUnlink: asyncNoop,
  }),
  'auth#SessionsSection': () => ({ sessions: [], onRevoke: asyncNoop, onRevokeOthers: asyncNoop }),
  'auth#DeleteAccountSection': () => ({
    subject: authSubject,
    graceDays: 30,
    requestDeleteCode: asyncNoop,
    onDelete: async () => ({ status: 'DELETION_SCHEDULED', purgeAfter: '2026-11-05T00:00:00Z' }),
  }),
  'legal#ConsentChecklist': () => ({ rows: [legalRow], checked: {}, onChange: noop }),
  'legal#SignUpConsents': () => ({
    api: fakeLegalApi(),
    slot: { onChange: noop, showError: false, refreshKey: 0 },
    locale: 'ko',
  }),
  'legal#DocumentDialog': () => ({ api: fakeLegalApi(), document: null, onClose: noop }),
  'legal#LegalDocumentView': () => ({
    document: {
      type: 'terms',
      version: '2026-10-01',
      locale: 'ko',
      effectiveFrom: '2026-10-01T00:00:00Z',
      current: true,
      template: false,
      title: '이용약관',
      sha256: 'x',
      required: true,
      requiredAtSignUp: true,
      markdown: '# 제1조\n\n본문',
    },
  }),
  'legal#ApiLegalDocumentPage': () => ({ api: fakeLegalApi(), type: 'terms' }),
  'legal#ReconsentScreen': () => ({ rows: [legalRow], onAgree: asyncNoop, onLeave: noop }),
  'legal#ReconsentGate': (ctx) => ({
    controller: legalController(ctx),
    api: fakeLegalApi(),
    accountId: null,
    onLeave: noop,
    locale: 'ko',
    children: createElement('p', null, 'app'),
  }),
  'legal#ConsentSettings': () => ({ api: fakeLegalApi(), locale: 'ko' }),
  'notifications#NotificationBell': () => ({ api: fakeNotificationsApi() }),
  'notifications#NotificationList': () => ({ items: [notification] }),
  'author-profile#AuthorPicker': () => ({ api: fakeAuthorProfileApi(), ...authorPickerSlot }),
  'author-profile#AuthorPickerView': () => ({
    profiles: [authorProfile],
    ...authorPickerSlot,
    value: 'prf_a',
  }),
  'author-profile#AuthorProfileManager': () => ({ api: fakeAuthorProfileApi() }),
  'board#ReactionBar': () => ({
    types: ['LIKE', 'EMPATHY'],
    counts: { LIKE: 2 },
    mine: ['LIKE'],
    onToggle: noop,
    labels: { EMPATHY: '공감' },
    icons: { LIKE: '👍' },
  }),
  'board#AuthorName': () => ({
    author: { authorId: 'a1', authorName: 'Ann', authorTag: '4821' },
    tag: 'always',
  }),
  'board#AuthorScope': () => ({ children: 'inside' }),
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
  'board#GuestFields': () => ({
    ui: { secretKind: 'PASSWORD', nameMaxLength: 20 },
    labels: {
      guestName: 'Your name',
      guestNameRequired: 'Enter a name.',
      guestNameTooLong: () => 'Too long',
      guestSecret: 'Password',
      guestSecretHint: 'Needed again to edit',
      guestSecretRequired: 'Enter a password.',
      guestCaptchaRequired: 'Complete the check.',
      guestPending: 'Waiting',
      guestEditPending: 'Waiting',
    },
    value: { name: '', secret: '' },
    onChange: () => undefined,
  }),
  'board#PostReactionBar': () => ({
    api: fakeBoardApi(),
    boardCode: 'free',
    post: boardPost,
    config: boardConfig,
  }),
  'payment#OrderStatusBadge': () => ({ status: 'PAID' }),
  'payment#OrderList': () => ({ orders: [paymentOrder], onOpen: noop }),
  'payment#PaymentResult': () => ({ order: paymentOrder }),
  'payment#OrderSummary': () => ({ order: paymentOrder, refunds: [], onRequestRefund: noop }),
  'payment#RefundRequestDialog': () => ({
    open: true,
    order: paymentOrder,
    onClose: noop,
    onConfirm: noop,
  }),
  'payment#TestModeNotice': () => ({}),
  'payment#EasyPayButtons': () => ({ codes: ['NAVERPAY'], onPick: noop }),
  'payment#SubscriptionStatusBadge': () => ({ status: 'ACTIVE' }),
  'payment#SubscriptionPlanList': () => ({
    plans: [
      {
        code: 'basic',
        name: 'Basic',
        amount: { amount: 3900, currency: 'KRW' },
        period: 'P1M',
        level: 1,
      },
    ],
    onSubscribe: noop,
  }),
  'payment#MySubscriptionCard': () => ({
    subscription: paymentSubscription,
    orders: [paymentOrder],
    onCancel: noop,
  }),
  'payment#ChangePlanDialog': () => ({
    open: true,
    plans: [
      {
        code: 'pro',
        name: 'Pro',
        amount: { amount: 9900, currency: 'KRW' },
        period: 'P1M',
        level: 3,
      },
    ],
    planCode: 'pro',
    onPlanChange: noop,
    onClose: noop,
    onConfirm: noop,
  }),
  'payment#CancelNowDialog': () => ({
    open: true,
    onClose: noop,
    onConfirm: noop,
  }),
  'payment#CancelNowResultNotice': () => ({
    result: {
      subscription: paymentSubscription,
      refund: { amount: 3393, currency: 'KRW' },
      withdrawal: false,
      lines: [],
      refunds: [],
    },
  }),
  'payment#CancelSubscriptionDialog': () => ({
    open: true,
    subscription: paymentSubscription,
    onClose: noop,
    onConfirm: noop,
  }),
  'captcha-turnstile#Turnstile': () => ({ siteKey: 'site-key', onToken: noop }),
}

/** 훅 — 작은 컴포넌트 안에서 이 인자로 불러 본다 */
export const HOOK_ARGS: Record<string, (ctx: FixtureContext) => unknown[]> = {
  'theme#useTheme': () => [],
  'ui#useSubmitAttempt': () => [],
  'auth#useAuth': () => [],
  'auth#useCodeClock': () => [],
  'auth#useCountdown': () => [],
  'auth#useEmailBeforeWrite': (ctx) => [call(ctx.mod('auth').createEmailRequiredController)],
  'auth#useLoginIdAvailability': () => [
    {
      api: { checkLoginId: () => new Promise(noop) },
      value: 'sumin',
      rules: { minLength: 4, maxLength: 20 },
    },
  ],
  'auth#useAuthMethods': () => [{ methods: () => new Promise(noop) }, true],
  'auth#useSocialLoginCallback': () => [{ complete: () => new Promise(noop) }, '?code=x'],
  'captcha-turnstile#useTurnstileToken': () => [],
  'notifications#useNotifications': () => [fakeNotificationsApi()],
  'notifications#useUnreadCount': () => [fakeNotificationsApi()],
  'notifications#useMarkRead': () => [fakeNotificationsApi()],
  'notifications#useMarkAllRead': () => [fakeNotificationsApi()],
  'notifications#useNotificationIngest': () => [],
  'payment#usePaymentConfig': () => [fakePaymentLedgerApi()],
  'payment#useCreateOrder': () => [fakePaymentLedgerApi()],
  'payment#useConfirmOrder': () => [fakePaymentLedgerApi()],
  'payment#useAbandonOrder': () => [fakePaymentLedgerApi()],
  'payment#useOrder': () => [fakePaymentLedgerApi(), 'ord_1'],
  'payment#useOrders': () => [fakePaymentLedgerApi()],
  'payment#useRequestRefund': () => [fakePaymentLedgerApi()],
  'payment#useWithdrawRefund': () => [fakePaymentLedgerApi()],
  'payment#useSubscriptionPlans': () => [fakeSubscriptionApi()],
  'payment#useMySubscription': () => [fakeSubscriptionApi()],
  'payment#useStartSubscription': () => [fakeSubscriptionApi()],
  'payment#useActivateSubscription': () => [fakeSubscriptionApi()],
  'payment#useCancelSubscription': () => [fakeSubscriptionApi()],
  'payment#useCancelSubscriptionNow': () => [fakeSubscriptionApi()],
  'payment#useCancelPreview': () => [fakeSubscriptionApi(), 'sub_1'],
  'payment#useChangeSubscriptionPlan': () => [fakeSubscriptionApi()],
  'payment#usePlanChangePreview': () => [fakeSubscriptionApi(), 'sub_1', 'pro'],
  'author-profile#useAuthorProfiles': () => [fakeAuthorProfileApi()],
  'author-profile#useProfileDialog': () => [{ api: fakeAuthorProfileApi(), title: 'Profiles' }],
  'author-profile#useAuthorProfileConfig': () => [fakeAuthorProfileApi()],
  'author-profile#useCreateAuthorProfile': () => [fakeAuthorProfileApi()],
  'author-profile#useRenameAuthorProfile': () => [fakeAuthorProfileApi()],
  'author-profile#useRemoveAuthorProfile': () => [fakeAuthorProfileApi()],
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
  'board#usePendingComments': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useCommentRevisions': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useUpdateBoard': () => [fakeBoardApi(), 'free'],
  'board#useDecidePostRevision': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useDecideCommentRevision': () => [fakeBoardApi(), 'free', 'p1'],
  'board#useOwnGuestIds': () => ['board:free:guest-comments'],
  'legal#useLegalDocuments': () => [fakeLegalApi()],
  'legal#useLegalDocument': () => [fakeLegalApi(), 'terms'],
  'legal#useMyConsents': () => [fakeLegalApi()],
  'legal#useConsentHistory': () => [fakeLegalApi(), 0],
  'legal#useAgree': () => [fakeLegalApi()],
  'legal#useWithdraw': () => [fakeLegalApi()],
  'marketing#useConsent': (ctx) => [
    call(ctx.mod('marketing').createConsentStore, { categories: ['necessary'], version: '1' }),
  ],
  'seo#useSeo': () => [{ title: 'Pricing' }, { siteName: 'Notes' }],
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
export const BROWSER_ONLY: Record<string, string> = {
  'payment#usePaddlePrices':
    "asks Paddle.js (a browser script) for prices in the buyer's currency - there is nothing to ask on the server",
}
