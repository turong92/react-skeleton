import type { PaymentAdminLabels } from './labelTypes'

/** 운영자 부품의 기본 문구(영어) */
export const defaultPaymentAdminLabels: PaymentAdminLabels = {
  reviewReason: {
    AMOUNT_MISMATCH: 'The provider received a different amount than the payment',
    REFUND_MISMATCH: 'The refunded amount does not match the provider',
    MODE_MISMATCH: 'Test and real payments got mixed up',
    CONFIRM_UNRESOLVED: 'The payment result could not be confirmed',
    ORDER_MISMATCH: 'The payment the provider reported is not this one',
    FULFILMENT_UNRESOLVED: 'The money was received but the delivery never finished',
    REFUND_APPLY_UNRESOLVED:
      'The refund went through but taking back what was delivered never finished',
    BUYER_COUNTRY_KR:
      'Paid through the overseas provider but the buyer address is in Korea - needs a look',
    SUBSCRIPTION_TOKEN_MISSING:
      'The first payment was received but the provider gave no payment method for renewals - the subscription ends at its next renewal',
    SUBSCRIPTION_STALE_CHARGE:
      'A subscription payment arrived late that the subscription was not waiting for - it needs a refund',
    SUBSCRIPTION_CANCEL_REFUND_UNRESOLVED:
      'The refund for a subscription that was ended early did not go out - it needs a refund',
    STALE_CONFIRMING: 'Stuck confirming the payment for a long time',
    STALE_REFUND: 'Stuck refunding for a long time',
    DISCOUNT_CONFLICT:
      'The coupon on this payment was also used by another payment - check which one keeps the discount',
  },
  reviewUnknown: 'Something here needs a check',
  reviewHint: 'Press "Match with the provider" to ask the provider again.',
  reviewHintDiscount:
    'Matching with the provider does not settle this. Look at both payments and refund the one that should not have the discount.',
  reviewHintRetry: 'Press "Match with the provider" to start the unfinished job again.',
  reviewHintSynced:
    'We asked the provider again, but this is still open. Please check it in the provider dashboard',
  reviewHintRetrySynced:
    'We started the unfinished job again. This notice goes away once it is done',
  erasedAccount: 'Closed account',
  refundFailure: {
    NOT_APPLIED: 'The provider did not apply the refund',
    PROVIDER_PENDING:
      "Waiting for the provider's refund result - this line changes when it is done",
    RESULT_MISMATCH: "The provider's answer did not match the request",
    ORDER_REFUNDED: 'The payment was already refunded, so this line was closed',
    LATE_RESULT:
      "The provider's refund result arrived after this line was closed. Check the other refund lines and the refunded amount",
    REFUND_DECLINED: 'The provider declined this refund',
    CHARGEBACK_WARNING:
      'From the warning of a card dispute - a chargeback of the same amount counts as the same dispute',
    PROVIDER_REJECTED: 'The provider turned this refund down. You can refund it again',
  },
  refundBlock: {
    UNSUPPORTED:
      'This provider cannot refund from the server. Refund in the provider dashboard, then decline the request',
    PROVIDER_OFF: 'The provider is switched off right now',
    MODE_MISMATCH: 'The key mode does not match this payment',
    OTHER: 'This cannot be refunded from the server right now',
  },
  eventCodes: {
    PROVIDER_PENDING_EXPIRED: 'The provider did not finish in time, so this line was closed',
    LATE_RESULT: "The provider's refund result arrived after this line was closed",
    LATE_RESULT_APPLIED:
      'The provider reported this closed line as refunded, so it was corrected to refunded',
  },
  actors: { USER: 'Buyer', OPERATOR: 'Operator', SYSTEM: 'System', PROVIDER: 'Provider' },
  eventTypes: {
    ORDER_CREATED: 'Payment started',
    EXEMPTED: 'Finished as payment waived - no provider was called',
    CONFIRM_STARTED: 'Started confirming the payment',
    CONFIRM_SUCCEEDED: 'Payment confirmed',
    CONFIRM_DECLINED: 'The card issuer declined the payment',
    CONFIRM_UNKNOWN: 'The payment result is not known yet',
    CONVERGED: 'Matched with the provider',
    EXPIRED: 'Time ran out',
    CANCELED: 'Stopped at the payment window',
    REOPENED_PAID: 'Found paid later',
    FULFILLED: 'Delivered',
    REFUND_REQUESTED: 'Refund requested',
    REFUND_SENT: 'Refund sent to the provider',
    REFUND_SUCCEEDED: 'Refunded',
    REFUND_FAILED: 'Refund did not go through',
    REFUND_UNKNOWN: 'The refund result is not known yet',
    REFUND_REJECTED: 'Refund request declined',
    REFUND_WITHDRAWN: 'Refund request taken back',
    REFUND_SYNCED: 'Refund matched with the provider',
    CHARGEBACK_REVERSED: 'Dispute won, the refund was reversed',
    REFUND_APPLIED: 'What was delivered was taken back for the refund',
    REVIEW_FLAGGED: 'Marked as needing a check',
    TRANSACTION_FAILED: 'The provider refused to prepare the payment',
  },
  unknownEvent: 'There is a record',
  webhookStatus: {
    RECEIVED: 'Received',
    PROCESSED: 'Handled',
    IGNORED: 'Skipped',
    FAILED: 'Not handled',
    DEAD: 'Gave up',
  },
  list: { errorTitle: 'Could not load the list' },
  orders: {
    caption: 'Payments',
    emptyTitle: 'No payments yet',
    emptyDescription: 'Payments show up here.',
    noMatchTitle: 'No payment matches',
    noMatchDescription: 'Check the payment number or change the status.',
    columns: {
      payment: 'Payment',
      amount: 'Amount',
      method: 'Paid with',
      status: 'Status',
      time: 'Time',
    },
    filterLabel: 'Find payments',
    statusFilter: 'Status',
    statusAll: 'All statuses',
    settlementFilter: 'How it was paid',
    settlementAll: 'All',
    settlementExempt: 'Payment waived',
    search: 'Payment number',
    searchHint: 'Type the payment number or the provider payment number exactly',
    searchSubmit: 'Find',
    includeErased: 'Also show payments of closed accounts',
    includeErasedHint:
      'Payments of closed accounts are hidden by default. The needs-a-check tab and finding one by its payment number always show them',
    details: 'Details',
    detailsFor: (orderName) => `Details: ${orderName}`,
  },
  routes: { toss: 'via Toss', kakaopay: 'direct', naverpay: 'direct' },
  panel: {
    id: 'Payment number',
    account: 'Account',
    provider: 'Provider',
    providerPayment: 'Provider payment number',
    failureCode: 'Reason code',
    refund: 'Refund',
    refundBlockedByRequest: 'A refund request is open. Refund or decline it below',
    stale: 'You can refund once the latest details have loaded',
    syncFirst: 'Match with the provider first',
    moneyOff: 'This payment is out of line with the provider, so it cannot be refunded',
    stillOff: 'Matched, but it is still out of line. Check it on the provider screen',
    syncHeld:
      'The refund you sent may still be on its way. Match with the provider again in a moment',
    refunded: (amount) => `Refunded: ${amount}`,
    refunding: (amount) => `Refund in progress: ${amount}`,
    sync: 'Match with the provider',
    syncing: 'Matching',
    synced: 'Matched with the provider',
    closeCharge: 'Close as not paid',
    syncErrors: {
      unsupported: 'This provider cannot be asked',
      unavailable: 'Could not reach the provider. Try again in a moment',
      modeMismatch:
        'This payment was made with a key for the other side (test or real), so the current key cannot match it',
      providerNotFound:
        'The provider could not find this payment. Please check it on the provider’s screen',
      other: 'Could not match. Try again',
    },
    approve: 'Refund as requested',
    approveFor: (amount, orderId) => `Refund as requested: ${amount} (payment ${orderId})`,
    reject: 'Decline request',
    rejectFor: (amount, orderId) => `Decline request: ${amount} (payment ${orderId})`,
    events: 'History',
    noEvents: 'No history yet',
  },
  closeChargeDialog: {
    title: 'Close this payment as not paid?',
    body: 'The provider never answered this subscription payment. Before closing, it asks the provider once more: if the payment shows as paid it is not closed but matched as paid. Once closed, this account can subscribe again. A provider that cannot look a payment up by number (KakaoPay) is closed only after you check in its own console.',
    confirm: 'Close as not paid',
    loading: 'Closing',
    dismiss: 'Close',
    close: 'Close dialog',
    errors: {
      notClosable:
        'This payment cannot be closed now. The provider is still working on it, or it has been settled. Check it with "Match with the provider".',
      needsConfirmation:
        'This provider cannot look a payment up by number. Check in its own console that this payment does not exist, then tick the box below to close it.',
      other:
        'Could not close it. When the provider cannot be asked it is not closed. Try again in a moment.',
    },
    confirmedAtProvider: "I checked in the provider's console that this payment does not exist",
  },
  refundDialog: {
    direct: { title: 'Refund this payment?', note: 'The money goes out and cannot be taken back.' },
    approve: {
      title: 'Refund as requested?',
      note: 'The requested amount is the default, and you can refund less. You cannot refund more than was requested, and it cannot be undone.',
    },
    reject: {
      title: 'Decline the refund request?',
      note: 'No money goes out if you decline.',
      confirm: 'Decline request',
      loading: 'Declining',
      error: 'Could not decline. Try again',
      unknown: 'Could not confirm the result. Close this and check what happened to the request',
    },
    confirm: 'Refund',
    loading: 'Refunding',
    amountLabel: 'Amount to refund',
    amountHint: (max) => `Can still be refunded: ${max}`,
    requestedAmount: 'Requested amount',
    reason: 'Reason',
    dismiss: 'Close',
    close: 'Close dialog',
    blocked: {
      empty: 'Type the amount to refund',
      invalid: 'Type a number',
      zero: 'Type an amount above zero',
      exceeds: (max) => `It cannot be more than what can still be refunded (${max})`,
    },
    endSubscription: {
      label: 'End the subscription too if refunded in full',
      hint: "Applies only when this period's charge is refunded in full. Turn it off and the next billing date still charges",
    },
    locked:
      'The amount and reason cannot be changed until the result is known. To use another amount, close this and check the result with "Match with the provider" first',
    sending: 'The amount and reason cannot be changed while this is being sent',
    errors: {
      unsupported:
        'This provider cannot refund from the server. Refund in the provider dashboard, then decline the request',
      modeMismatch:
        'This payment was made with a key for the other side (test or real), so the current key cannot refund it',
      notAllowed:
        'This cannot be refunded right now. First check with "Match with the provider" that it agrees with the provider',
      approveNotAllowed:
        'This request cannot be refunded as asked right now. Check the payment itself',
      requestWaiting: 'A refund request is waiting. Decide that request first',
      approveExceeded:
        'The requested amount is more than what can be refunded now. Decline the request, or refund by hand from the payment itself',
      amountExceeded: 'The amount that can be refunded changed. Close this and open it again',
      declined: {
        ALREADY_REFUNDED:
          'The provider says it is already refunded. Use "Match with the provider" to update the ledger',
        AMOUNT_EXCEEDED: 'The provider says this amount cannot be refunded',
        PARTIAL_NOT_ALLOWED: 'This payment cannot be refunded in part. Refund all of it',
        PERIOD_EXPIRED: 'The time to refund this has passed',
        TEMPORARY: 'The provider has a problem right now. Try again in a moment',
        OTHER: 'The provider did not take the refund',
      },
      invalid: 'What was sent is not valid. Check the amount and the reason, then try again',
      other: 'Could not refund. Try again',
      unavailable: 'Cannot send the refund right now. Try again in a moment',
      unknown:
        'Could not confirm the refund result. Check the refunds on the payment to see whether it went out. If it did not, you can send the same refund again',
      notDone: 'This refund line was closed without a refund. Check the refunds on the payment',
      alreadyDecided: 'This request was already handled',
      requestClosed:
        'The request was closed as not refunded. Refund it by hand from the payment itself',
    },
  },
  requests: {
    caption: 'Refund requests',
    emptyTitle: 'No refund requests are waiting',
    emptyDescription: 'New requests show up here.',
    columns: {
      payment: 'Payment number',
      amount: 'Amount',
      reason: 'Reason',
      requestedAt: 'Asked on',
      status: 'Status',
    },
    details: 'View payment',
    detailsFor: (orderId) => `View payment: ${orderId}`,
  },
  webhooks: {
    caption: 'Webhook inbox',
    emptyTitle: 'No webhooks received',
    emptyDescription: 'What the provider sends shows up here.',
    columns: {
      receivedAt: 'Received on',
      event: 'Event',
      resource: 'Provider payment number',
      order: 'Payment number',
      status: 'Status',
      deliveries: 'Times received',
      reason: 'Reason code',
    },
    limitMarker: {
      waiting:
        'Too many notices came in for this payment, so they will be checked together once, a little later',
      done: 'Too many notices came in for this payment, so they were checked together once',
      retrying:
        'Too many notices came in for this payment and the one check could not be done this time, so it is being tried again',
      failed:
        'Too many notices came in for this payment and the one check could not be done. Please process it again',
      name: 'Notice pile-up',
    },
    noProviderPayment: (orderId) => `No provider payment number (payment ${orderId})`,
    retry: 'Process again',
    retried: 'Queued again',
    retryFor: (eventType, target) => `Process again: ${eventType} (${target})`,
    retrying: 'Processing',
  },
}
