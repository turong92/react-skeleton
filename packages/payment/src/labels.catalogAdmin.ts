import type { CatalogKind } from './catalogTypes'
import type { CatalogProblem } from './admin/catalogErrors'
import type { PriceState } from './admin/priceState'

/** 운영 카탈로그(상품 · 가격) 화면의 글자 - `PaymentLabels.admin.catalog`. 가격 줄은 고치지 않고 새 줄을 더하며 「판매 중지」한다 */
export type CatalogAdminLabels = {
  kinds: Record<CatalogKind, string>
  table: {
    caption: string
    emptyTitle: string
    emptyDescription: string
    columns: { product: string; kind: string; level: string; status: string; price: string }
    selling: string
    notSelling: string
    highlighted: string
    /** 지금 살 수 있는 가격이 하나도 없다 */
    noPrice: string
    details: string
    detailsFor: (name: string) => string
  }
  editor: {
    code: string
    codeHint: string
    kind: string
    level: string
    levelHint: string
    highlighted: string
    selling: string
    sortOrder: string
    sortOrderHint: string
    texts: string
    name: (language: string) => string
    description: (language: string) => string
    create: string
    save: string
    saving: string
    problems: {
      codeEmpty: string
      codeInvalid: string
      nameEmpty: (language: string) => string
      levelEmpty: string
      levelInvalid: string
      sortOrderInvalid: string
    }
  }
  prices: {
    heading: string
    empty: string
    add: string
    currency: (currency: string) => string
    columns: { price: string; period: string; amount: string; sale: string; state: string }
    states: Record<PriceState, string>
    /** 「정가 69,000원」 */
    regular: (money: string) => string
    saleFrom: (when: string) => string
    saleUntil: (when: string) => string
    periods: { monthly: string; yearly: string; once: string }
    stop: string
    stopFor: (code: string) => string
    changeSale: string
    changeSaleFor: (code: string) => string
    links: {
      legend: string
      provider: (id: string) => string
      /** 입력칸의 이름 - 결제사 가격 id */
      idLabel: (provider: string, code: string) => string
      notLinked: string
      save: string
      saveFor: (provider: string, code: string) => string
      remove: string
      removeFor: (provider: string, code: string) => string
      removeDialog: {
        title: string
        body: string
        confirm: string
        dismiss: string
        close: string
        loading: string
      }
    }
  }
  addPrice: {
    title: string
    period: string
    periodMonthly: string
    periodYearly: string
    periodCustom: string
    periodCustomLabel: string
    periodCustomHint: string
    amount: string
    /** `example` - 통화의 자릿수에 맞는 예(원 `9900` · 달러 `9.99`) */
    amountHint: (currency: string, example: string) => string
    currency: string
    currencyCustom: string
    currencyCustomLabel: string
    currencyCustomHint: string
    code: string
    codeHint: string
    sale: string
    saleHint: string
    regularAmount: string
    regularAmountHint: string
    saleStarts: string
    saleEnds: string
    saleWindowHint: string
    replaces: string
    replacesNone: string
    /** 고른 옛 가격이 어떻게 되는지 - 한 번에 판매 중지된다 */
    replacesHint: (code: string) => string
    replacesOption: (code: string, money: string) => string
    submit: string
    cancel: string
    close: string
    loading: string
    problems: {
      amountEmpty: string
      amountInvalid: string
      amountZero: string
      periodInvalid: string
      currencyInvalid: string
      regularNotAbove: string
      regularEmpty: string
      endBeforeStart: string
      timeInvalid: string
    }
  }
  saleEndDialog: {
    title: string
    which: (code: string, money: string) => string
    end: string
    /** 시작 없는 행사는 끝을 비울 수 없다(비우면 상시 가격이 된다) */
    endRequired: string
    hint: string
    submit: string
    cancel: string
    close: string
    loading: string
  }
  stopDialog: {
    title: string
    /** 어느 가격인지 한 줄 */
    which: (code: string, money: string) => string
    body: string
    confirm: string
    dismiss: string
    close: string
    loading: string
  }
  /** `refTaken` - 이미 다른 가격에 이어진 결제사 가격 id 를 이으려 했다(`CATALOG.CODE_TAKEN` 이 결제사 링크 칸에서 오면) */
  errors: Record<CatalogProblem | 'other' | 'refTaken', string>
}

export const koCatalogAdminLabels: CatalogAdminLabels = {
  kinds: { SUBSCRIPTION: '구독', ONE_TIME: '단건' },
  table: {
    caption: '상품 목록',
    emptyTitle: '아직 상품이 없어요',
    emptyDescription: '상품을 만들면 여기에 보여요.',
    columns: { product: '상품', kind: '종류', level: '등급', status: '상태', price: '지금 가격' },
    selling: '판매 중',
    notSelling: '판매 중지',
    highlighted: '인기',
    noPrice: '팔 수 있는 가격 없음',
    details: '자세히',
    detailsFor: (name) => `자세히: ${name}`,
  },
  editor: {
    code: '상품 코드',
    codeHint: '영문 소문자 · 숫자 · 하이픈 · 밑줄. 만든 뒤에는 바꿀 수 없어요.',
    kind: '종류',
    level: '등급',
    levelHint: '높을수록 윗등급이에요. 구독 상품끼리 같은 등급은 쓸 수 없어요.',
    highlighted: '인기 상품으로 강조',
    selling: '판매 중',
    sortOrder: '정렬 순서',
    sortOrderHint: '작을수록 앞에 보여요.',
    texts: '언어별 이름과 설명',
    name: (language) => `이름 (${language})`,
    description: (language) => `설명 (${language})`,
    create: '상품 만들기',
    save: '저장',
    saving: '저장하는 중',
    problems: {
      codeEmpty: '상품 코드를 적어 주세요',
      codeInvalid: '영문 소문자 · 숫자 · 하이픈 · 밑줄만, 64자까지 쓸 수 있어요',
      nameEmpty: (language) => `${language} 이름을 적어 주세요`,
      levelEmpty: '구독 상품은 등급을 정해 주세요',
      levelInvalid: '등급은 1 이상의 정수예요',
      sortOrderInvalid: '정렬 순서는 정수예요',
    },
  },
  prices: {
    heading: '가격',
    empty: '아직 가격이 없어요. 가격을 더하면 팔 수 있어요.',
    add: '가격 더하기',
    currency: (currency) => `${currency} 가격`,
    columns: { price: '가격', period: '주기', amount: '금액', sale: '행사', state: '상태' },
    states: {
      current: '지금 팔려요',
      scheduled: '행사 예정',
      ended: '행사 끝남',
      covered: '행사가에 가려짐',
      stopped: '판매 중지',
      productStopped: '상품 판매 중지',
    },
    regular: (money) => `정가 ${money}`,
    saleFrom: (when) => `${when}부터`,
    saleUntil: (when) => `${when}까지`,
    periods: { monthly: '월간', yearly: '연간', once: '한 번' },
    stop: '판매 중지',
    stopFor: (code) => `판매 중지: ${code}`,
    changeSale: '행사 기간 바꾸기',
    changeSaleFor: (code) => `행사 기간 바꾸기: ${code}`,
    links: {
      legend: '결제사 가격 연결',
      provider: (id) => (id === 'paddle' ? 'Paddle' : id),
      idLabel: (provider, code) => `${provider} 가격 id (${code})`,
      notLinked: '연결 안 됨',
      save: '연결',
      saveFor: (provider, code) => `연결: ${provider} (${code})`,
      remove: '연결 끊기',
      removeFor: (provider, code) => `연결 끊기: ${provider} (${code})`,
      removeDialog: {
        title: '결제사 가격 연결을 끊을까요?',
        body: '이 가격은 결제사에서 다시 연결하기 전까지 결제사 결제창에서 팔 수 없어요. 이미 구독 중인 사람은 영향이 없어요.',
        confirm: '연결 끊기',
        dismiss: '닫기',
        close: '창 닫기',
        loading: '끊는 중',
      },
    },
  },
  addPrice: {
    title: '가격 더하기',
    period: '결제 주기',
    periodMonthly: '월간 (P1M)',
    periodYearly: '연간 (P1Y)',
    periodCustom: '직접 입력',
    periodCustomLabel: '주기 (ISO-8601)',
    periodCustomHint: '예: P3M 은 3개월마다',
    amount: '금액',
    amountHint: (currency, example) => `${currency} 기준으로 적어요. 예: ${example}`,
    currency: '통화',
    currencyCustom: '직접 입력',
    currencyCustomLabel: '통화 코드',
    currencyCustomHint: '세 글자 영문 대문자. 예: JPY',
    code: '가격 코드',
    codeHint: '비워 두면 서버가 정해요. 구독자의 플랜 코드가 돼서 나중에 바꿀 수 없어요.',
    sale: '행사가로 팔기',
    saleHint: '켜면 위 금액이 행사가이고, 정가는 줄을 그어 보여요.',
    regularAmount: '정가',
    regularAmountHint: '행사가보다 커야 해요.',
    saleStarts: '시작 시각',
    saleEnds: '끝나는 시각',
    replaces: '이 가격을 대신함 (선택)',
    replacesNone: '대신하는 가격 없음',
    replacesHint: (code) =>
      `더하는 순간 ${code} 가격은 판매 중지돼요. 기존 구독자는 그 가격 그대로예요.`,
    replacesOption: (code, money) => `${code} (${money})`,
    saleWindowHint:
      '내 기기의 시간대로 읽어요. 시작을 비우면 지금부터, 끝을 비우면 끝 없이 이어져요.',
    submit: '가격 더하기',
    cancel: '닫기',
    close: '창 닫기',
    loading: '더하는 중',
    problems: {
      amountEmpty: '금액을 적어 주세요',
      amountInvalid: '금액은 숫자로 적어 주세요 (통화의 소수 자릿수까지)',
      amountZero: '금액은 0보다 커야 해요',
      periodInvalid: '주기를 ISO-8601 로 적어 주세요 (예: P1M)',
      currencyInvalid: '통화 코드는 영문 대문자 세 글자예요',
      regularNotAbove: '정가는 행사가보다 커야 해요',
      regularEmpty: '정가를 적어 주세요',
      endBeforeStart: '끝나는 시각이 시작 시각보다 늦어야 해요',
      timeInvalid: '시각을 다시 확인해 주세요',
    },
  },
  saleEndDialog: {
    title: '행사 기간 바꾸기',
    which: (code, money) => `${code} · ${money}`,
    end: '끝나는 시각',
    endRequired: '시작 시각이 없는 행사는 끝을 비울 수 없어요. 비우면 상시 가격이 돼요.',
    hint: '내 기기의 시간대로 읽어요. 비우면 끝 없이 이어져요. 지난 시각을 적으면 바로 끝나요.',
    submit: '바꾸기',
    cancel: '닫기',
    close: '창 닫기',
    loading: '바꾸는 중',
  },
  stopDialog: {
    title: '이 가격의 판매를 중지할까요?',
    which: (code, money) => `${code} · ${money}`,
    body: '기존 구독자는 이 가격 그대로 이어져요. 새로 사는 사람에게만 더 이상 보이지 않고, 되돌릴 수 없어요. 다시 팔려면 새 가격을 더하세요.',
    confirm: '판매 중지',
    dismiss: '닫기',
    close: '창 닫기',
    loading: '중지하는 중',
  },
  errors: {
    codeTaken: '이미 쓰는 코드예요. 다른 코드를 적어 주세요.',
    levelTaken: '다른 구독 상품이 이미 쓰는 등급이에요.',
    priceOverlap: '같은 주기 · 통화에 판매 기간이 겹치는 가격이 있어요. 기간을 바꿔 주세요.',
    priceInvalid: '가격 값이 올바르지 않아요. 금액 · 주기 · 행사 기간을 확인해 주세요.',
    notFound: '찾는 상품이나 가격이 없어요. 목록을 새로 읽어 주세요.',
    invalidInput: '입력을 확인해 주세요. 틀린 칸 아래에 이유를 적었어요.',
    refTaken: '이미 다른 가격에 연결된 id 예요. 다른 id 를 적어 주세요.',
    other: '저장하지 못했어요. 잠시 뒤 다시 해 주세요.',
  },
}

export const defaultCatalogAdminLabels: CatalogAdminLabels = {
  kinds: { SUBSCRIPTION: 'Subscription', ONE_TIME: 'One-time' },
  table: {
    caption: 'Products',
    emptyTitle: 'No products yet',
    emptyDescription: 'Products you create show up here.',
    columns: {
      product: 'Product',
      kind: 'Kind',
      level: 'Level',
      status: 'Status',
      price: 'Price now',
    },
    selling: 'On sale',
    notSelling: 'Not on sale',
    highlighted: 'Popular',
    noPrice: 'No price on sale',
    details: 'Details',
    detailsFor: (name) => `Details: ${name}`,
  },
  editor: {
    code: 'Product code',
    codeHint:
      'Lowercase letters, digits, hyphens and underscores. It cannot be changed after creation.',
    kind: 'Kind',
    level: 'Level',
    levelHint: 'Higher is a higher tier. Two subscription products cannot share a level.',
    highlighted: 'Highlight as popular',
    selling: 'On sale',
    sortOrder: 'Position',
    sortOrderHint: 'A smaller number shows first.',
    texts: 'Names and descriptions by language',
    name: (language) => `Name (${language})`,
    description: (language) => `Description (${language})`,
    create: 'Create product',
    save: 'Save',
    saving: 'Saving',
    problems: {
      codeEmpty: 'Enter a product code',
      codeInvalid:
        'Use lowercase letters, digits, hyphens and underscores only, up to 64 characters',
      nameEmpty: (language) => `Enter the ${language} name`,
      levelEmpty: 'Set a level for a subscription product',
      levelInvalid: 'Level is a whole number, 1 or more',
      sortOrderInvalid: 'The position is a whole number',
    },
  },
  prices: {
    heading: 'Prices',
    empty: 'No prices yet. Add a price to sell it.',
    add: 'Add a price',
    currency: (currency) => `${currency} prices`,
    columns: { price: 'Price', period: 'Period', amount: 'Amount', sale: 'Sale', state: 'State' },
    states: {
      current: 'On sale now',
      scheduled: 'Sale scheduled',
      ended: 'Sale ended',
      covered: 'Covered by a sale',
      stopped: 'Stopped',
      productStopped: 'Product not on sale',
    },
    regular: (money) => `Regular ${money}`,
    saleFrom: (when) => `From ${when}`,
    saleUntil: (when) => `Until ${when}`,
    periods: { monthly: 'Monthly', yearly: 'Yearly', once: 'One time' },
    stop: 'Stop selling',
    stopFor: (code) => `Stop selling: ${code}`,
    changeSale: 'Change sale period',
    changeSaleFor: (code) => `Change sale period: ${code}`,
    links: {
      legend: 'Provider price links',
      provider: (id) => (id === 'paddle' ? 'Paddle' : id),
      idLabel: (provider, code) => `${provider} price id (${code})`,
      notLinked: 'Not linked',
      save: 'Link',
      saveFor: (provider, code) => `Link: ${provider} (${code})`,
      remove: 'Unlink',
      removeFor: (provider, code) => `Unlink: ${provider} (${code})`,
      removeDialog: {
        title: 'Unlink the provider price?',
        body: 'This price cannot be sold in the provider checkout until it is linked again. People already subscribed are not affected.',
        confirm: 'Unlink',
        dismiss: 'Close',
        close: 'Close dialog',
        loading: 'Unlinking',
      },
    },
  },
  addPrice: {
    title: 'Add a price',
    period: 'Billing period',
    periodMonthly: 'Monthly (P1M)',
    periodYearly: 'Yearly (P1Y)',
    periodCustom: 'Other',
    periodCustomLabel: 'Period (ISO-8601)',
    periodCustomHint: 'For example P3M is every 3 months',
    amount: 'Amount',
    amountHint: (currency, example) => `In ${currency}. For example ${example}`,
    currency: 'Currency',
    currencyCustom: 'Other',
    currencyCustomLabel: 'Currency code',
    currencyCustomHint: 'Three uppercase letters, for example JPY',
    code: 'Price code',
    codeHint:
      'Leave empty and the server picks one. It becomes the subscribers plan code and cannot be changed later.',
    sale: 'Sell at a sale price',
    saleHint:
      'When on, the amount above is the sale price and the regular price is struck through.',
    regularAmount: 'Regular price',
    regularAmountHint: 'Must be higher than the sale price.',
    saleStarts: 'Starts at',
    saleEnds: 'Ends at',
    replaces: 'Replaces this price (optional)',
    replacesNone: 'Replaces no price',
    replacesHint: (code) =>
      `The moment this is added, ${code} stops selling. Existing subscribers keep that price.`,
    replacesOption: (code, money) => `${code} (${money})`,
    saleWindowHint: 'Read in your device time zone. Empty start means now, empty end means no end.',
    submit: 'Add price',
    cancel: 'Close',
    close: 'Close dialog',
    loading: 'Adding',
    problems: {
      amountEmpty: 'Enter an amount',
      amountInvalid: 'Enter a number (up to the currency decimals)',
      amountZero: 'The amount must be more than 0',
      periodInvalid: 'Enter the period in ISO-8601 (for example P1M)',
      currencyInvalid: 'A currency code is three uppercase letters',
      regularNotAbove: 'The regular price must be higher than the sale price',
      regularEmpty: 'Enter the regular price',
      endBeforeStart: 'The end must be after the start',
      timeInvalid: 'Check the time',
    },
  },
  saleEndDialog: {
    title: 'Change sale period',
    which: (code, money) => `${code} - ${money}`,
    end: 'Ends at',
    endRequired:
      'A sale without a start cannot have an empty end. Empty would make it a regular price.',
    hint: 'Read in your device time zone. Empty means no end. A time in the past ends the sale right away.',
    submit: 'Change',
    cancel: 'Close',
    close: 'Close dialog',
    loading: 'Changing',
  },
  stopDialog: {
    title: 'Stop selling this price?',
    which: (code, money) => `${code} - ${money}`,
    body: 'Existing subscribers keep this price. It only disappears for new buyers and cannot be undone. To sell again, add a new price.',
    confirm: 'Stop selling',
    dismiss: 'Close',
    close: 'Close dialog',
    loading: 'Stopping',
  },
  errors: {
    codeTaken: 'That code is already taken. Use another one.',
    levelTaken: 'Another subscription product already uses that level.',
    priceOverlap:
      'A price with an overlapping sale period already exists for that period and currency. Change the dates.',
    priceInvalid: 'The price is not valid. Check the amount, period and sale dates.',
    notFound: 'That product or price no longer exists. Reload the list.',
    invalidInput: 'Check your input. The reason is under each wrong field.',
    refTaken: 'That id is already linked to another price. Use a different id.',
    other: 'Could not save. Try again in a moment.',
  },
}
