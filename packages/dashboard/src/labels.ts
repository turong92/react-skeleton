/**
 * 화면 문구. 기본은 영어이고 `koDashboardLabels` 가 한국어다 - 앱이 로케일에 맞는 것을 `labels` prop 으로 넘기거나 일부만 덮는다
 * (`{ ...defaultDashboardLabels, title: '…' }`). 서버가 주는 이름(`label` · `columns`)은 아래 맵에 키가 있으면 그것으로, 없으면 서버 글자 그대로 쓴다.
 */
export type DashboardLabels = {
  title: string
  periodGroup: string
  periods: { today: string; '7d': string; '30d': string; custom: string }
  customRange: {
    legend: string
    start: string
    end: string
    apply: string
    orderProblem: string
    longProblem: string
  }
  compare: string
  vsPrevious: string
  notComparable: string
  newValue: string
  tilesLabel: string
  trendTitle: (metric: string) => string
  trendChartLabel: (metric: string) => string
  legendCurrent: string
  legendPrevious: string
  /** 선택한 지표에 그릴 점이 없을 때 */
  noSeries: string
  loading: string
  loadFailed: string
  retry: string
  /** 출처 키(`db` · `cloudflare` · `ga` · `app`) → 이름 */
  sources: Record<string, string>
  freshness: {
    live: string
    cached: (asOf: string) => string
    daily: (asOf: string) => string
    /** 오늘이 든 기간의 Cloudflare 숫자(약 5분 근실시간) */
    minutesAgo: (minutes: number) => string
    /** 오늘이 든 기간의 GA 숫자 - GA 는 오늘을 적재 · 질의하지 않아 어제까지만 나온다. 마지막 적재 시각의 시(0~23) */
    gaThroughYesterday: (hour: string) => string
  }
  status: {
    /** 출처 키별 안내. `*` 는 없는 출처의 기본 */
    notConnected: Record<string, string>
    noHistory: string
    error: string
    noRows: string
  }
  tileUnavailable: string
  /** 타일 아래 자세히 보기 링크(`metric.link` 가 있을 때) */
  detailsLink: string
  viewAll: string
  viewAllTitle: (ranking: string) => string
  close: string
  groups: Record<string, string>
  rankingTabsLabel: (group: string) => string
  funnel: {
    title: string
    hint: string
    people: (count: string) => string
    start: string
    /** 단계가 묶음(첫 단계)의 몇 %인지 - 서버의 `rate` */
    ofCohort: (cohort: string, rate: string) => string
    /** 퍼널 위 참고 줄 - 방문(익명)과 방문 대비 묶음 비율. 인자: 방문 이름 · 방문 수 · 묶음 이름 · 비율 */
    reference: (visits: string, count: string, cohort: string, rate: string) => string
    empty: string
    /** 묶음이 너무 커서(5만 계정 초과) 못 셀 때 */
    tooLarge: string
  }
  app: { title: string; badge: string }
  returning: { title: string; caption: string; returning: string; first: string }
  edit: {
    edit: string
    done: string
    reset: string
    saving: string
    saveFailed: string
    /** 편집 중 맨 위 안내 */
    hint: string
    /** 이 브라우저에만 저장될 때(서버에 저장소가 없다) */
    browserOnly: string
    show: (name: string) => string
    moveUp: (name: string) => string
    moveDown: (name: string) => string
    /** 끈 카드의 자리 표시 */
    off: (name: string) => string
  }
  realtime: {
    /** 헤더의 「지금 N명」 */
    badge: (count: string) => string
    title: string
    /** 패널 맨 위 - 쿠키에 동의한 방문자만 센다는 표기 */
    note: string
    pages: string
    countries: string
    users: string
    empty: string
  }
  /** 지표 키 → 타일 이름 */
  metrics: Record<string, string>
  /** 순위 키 → 탭 이름 */
  rankings: Record<string, string>
  /** 서버가 주는 열 이름 → 표시 글자 */
  columns: Record<string, string>
  /** 퍼널 단계 키 → 이름 */
  funnelSteps: Record<string, string>
  /** 통화 → 금액 뒤 글자(`{ KRW: '원' }`) */
  currencySuffix: Record<string, string>
}

export const defaultDashboardLabels: DashboardLabels = {
  title: 'Dashboard',
  periodGroup: 'Period',
  periods: { today: 'Today', '7d': '7 days', '30d': '30 days', custom: 'Custom' },
  customRange: {
    legend: 'Custom period',
    start: 'From',
    end: 'To',
    apply: 'Apply',
    orderProblem: 'The end date must not be before the start date',
    longProblem: 'Pick at most 366 days',
  },
  compare: 'Compare with previous period',
  vsPrevious: 'vs previous period',
  notComparable: 'Not comparable',
  newValue: 'New',
  tilesLabel: 'Key metrics',
  trendTitle: (metric) => `${metric} over time`,
  trendChartLabel: (metric) => `${metric} chart`,
  legendCurrent: 'This period',
  legendPrevious: 'Previous period',
  noSeries: 'No data for this period',
  loading: 'Loading the dashboard',
  loadFailed: 'The dashboard could not be loaded',
  retry: 'Try again',
  sources: { db: 'App DB', cloudflare: 'Cloudflare', ga: 'Google Analytics', app: 'App' },
  freshness: {
    live: 'Live',
    cached: (asOf) => `Updated ${asOf}`,
    daily: (asOf) => `Daily, loaded ${asOf}`,
    minutesAgo: (minutes) => `About ${minutes} min ago`,
    gaThroughYesterday: (hour) => `GA through yesterday (loaded ${hour}:00)`,
  },
  status: {
    notConnected: {
      cloudflare: 'Add a Cloudflare token to see this',
      ga: 'Add Google Analytics credentials to see this',
      '*': 'Connect the source to see this',
    },
    noHistory: 'No history was stored for this period',
    error: 'The source could not be reached. Try again later',
    noRows: 'Nothing in this period yet',
  },
  tileUnavailable: '-',
  detailsLink: 'See details',
  viewAll: 'View all',
  viewAllTitle: (ranking) => `${ranking} - all`,
  close: 'Close',
  groups: { traffic: 'Traffic', pages: 'Pages', geo: 'Places and devices', app: 'App' },
  rankingTabsLabel: (group) => `${group} views`,
  funnel: {
    title: 'Funnel',
    hint: 'How far visitors got',
    people: (count) => `${count}`,
    start: 'Start',
    ofCohort: (cohort, rate) => `${rate} of ${cohort}`,
    reference: (visits, count, cohort, rate) =>
      `${visits} ${count} - ${rate} of visits became ${cohort}`,
    empty: 'No funnel data yet',
    tooLarge: 'The period is too long to count the funnel - shorten the period',
  },
  app: { title: 'App stats', badge: 'Added by the app' },
  returning: {
    title: 'Returning visitors',
    caption: 'Share of people who came back in this period',
    returning: 'Returning',
    first: 'New',
  },
  edit: {
    edit: 'Edit',
    done: 'Done',
    reset: 'Reset layout',
    saving: 'Saving',
    saveFailed: 'The layout could not be saved. Try again',
    hint: 'Editing - turn tiles and cards on or off, and move cards with the arrows (or drag them). Press Done to save.',
    browserOnly: 'Saved in this browser only',
    show: (name) => `Show ${name}`,
    moveUp: (name) => `Move ${name} earlier`,
    moveDown: (name) => `Move ${name} later`,
    off: (name) => `${name} - off`,
  },
  realtime: {
    badge: (count) => `${count} online now`,
    title: 'Right now',
    note: 'GA - visitors who accepted analytics cookies',
    pages: 'Pages',
    countries: 'Countries',
    users: 'Users',
    empty: 'Nobody is on the site right now',
  },
  metrics: {},
  rankings: {},
  columns: {},
  funnelSteps: {},
  currencySuffix: {},
}

export const koDashboardLabels: DashboardLabels = {
  ...defaultDashboardLabels,
  title: '관리자 대시보드',
  periodGroup: '기간 고르기',
  periods: { today: '오늘', '7d': '7일', '30d': '30일', custom: '직접' },
  customRange: {
    legend: '직접 고른 기간',
    start: '시작일',
    end: '종료일',
    apply: '적용',
    orderProblem: '종료일이 시작일보다 앞입니다',
    longProblem: '최대 366일까지 고를 수 있습니다',
  },
  compare: '직전 기간과 비교',
  vsPrevious: '직전 기간 대비',
  notComparable: '비교 불가',
  newValue: '신규',
  tilesLabel: '핵심 지표',
  trendTitle: (metric) => `${metric} 추이`,
  trendChartLabel: (metric) => `${metric} 기간 추이 그래프`,
  legendCurrent: '이번 기간',
  legendPrevious: '직전 기간',
  noSeries: '이 기간에는 그릴 데이터가 없습니다',
  loading: '대시보드를 불러오는 중',
  loadFailed: '대시보드를 불러오지 못했습니다',
  retry: '다시 시도',
  sources: { db: '앱 DB', cloudflare: 'Cloudflare', ga: 'Google Analytics', app: '앱' },
  freshness: {
    live: '실시간',
    cached: (asOf) => `${asOf} 갱신`,
    daily: (asOf) => `어제치 · ${asOf} 적재`,
    minutesAgo: (minutes) => `약 ${minutes}분 전 기준`,
    gaThroughYesterday: (hour) => `GA 는 어제까지 (${hour}시 적재)`,
  },
  status: {
    notConnected: {
      cloudflare: 'Cloudflare 토큰을 넣으면 보입니다',
      ga: 'GA 키를 넣으면 보입니다',
      '*': '출처를 연결하면 보입니다',
    },
    noHistory: '이 기간에는 쌓인 기록이 없습니다',
    error: '출처에 연결하지 못했습니다. 잠시 뒤 다시 확인해 주세요',
    noRows: '이 기간에는 아직 없습니다',
  },
  detailsLink: '자세히 보기',
  viewAll: '전체 보기',
  viewAllTitle: (ranking) => `${ranking} 전체`,
  close: '닫기',
  groups: { traffic: '유입', pages: '페이지', geo: '지역 · 기기', app: '앱' },
  rankingTabsLabel: (group) => `${group} 보기 바꾸기`,
  funnel: {
    title: '퍼널',
    hint: '방문한 사람이 어디까지 갔는지',
    people: (count) => `${count}명`,
    start: '시작 단계',
    ofCohort: (cohort, rate) => `${cohort} 대비 ${rate}`,
    reference: (visits, count, cohort, rate) =>
      `${visits} ${count}명 · 방문 대비 ${cohort} ${rate}`,
    empty: '아직 퍼널 데이터가 없습니다',
    tooLarge: '기간이 너무 길어 퍼널을 셀 수 없습니다 - 기간을 줄여 주세요',
  },
  app: { title: '앱 통계', badge: '앱이 붙임' },
  returning: {
    title: '재방문율',
    caption: '기간 내 다시 찾아온 비율',
    returning: '재방문',
    first: '처음 방문',
  },
  edit: {
    edit: '편집',
    done: '완료',
    reset: '기본 배치로 되돌리기',
    saving: '저장 중',
    saveFailed: '배치를 저장하지 못했습니다. 다시 눌러 주세요',
    hint: '편집 중 - 타일과 카드를 켜고 끄고, 카드는 화살표(또는 끌어서)로 순서를 바꿉니다. 「완료」를 누르면 저장됩니다.',
    browserOnly: '이 브라우저에만 저장됩니다',
    show: (name) => `${name} 보이기`,
    moveUp: (name) => `${name} 앞으로`,
    moveDown: (name) => `${name} 뒤로`,
    off: (name) => `${name} - 꺼짐`,
  },
  realtime: {
    badge: (count) => `지금 ${count}명`,
    title: '지금',
    note: 'GA · 분석 쿠키에 동의한 방문자만 셉니다',
    pages: '페이지',
    countries: '국가',
    users: '사용자',
    empty: '지금 사이트에 있는 사람이 없습니다',
  },
  metrics: {
    'cloudflare.visits': '방문',
    'cloudflare.pageviews': '페이지뷰',
    'account.signed-up': '신규 가입',
    'auth-session.active': '활성 이용자',
    'payment.net-revenue': '순매출',
    'payment.paid-count': '결제 건수',
  },
  rankings: {
    'cloudflare.referrers': '소스',
    'cloudflare.paths': '많이 본',
    'cloudflare.countries': '국가',
    'cloudflare.devices': '기기',
    'ga.channels': '채널 · 전환',
    'ga.campaigns': '캠페인',
    'ga.landing-pages': '첫 페이지',
    'ga.page-transitions': '페이지 이동',
    'ga.returning': '재방문',
  },
  columns: {
    Source: '소스',
    Visits: '방문',
    Page: '페이지',
    Views: '조회',
    Country: '국가',
    Device: '기기',
    Channel: '채널',
    Sessions: '세션',
    Conversions: '전환',
    Campaign: '캠페인',
    'Landing page': '첫 페이지',
    Transition: '이동 (A → B)',
    Count: '횟수',
  },
  funnelSteps: {
    'cloudflare.visits': '방문',
    'account.signed-up': '가입',
  },
}
