import type { WebhookEvent } from './types'

/**
 * 표식 줄 - 한 결제의 웹훅이 창 상한(`webhook.per-order-limit`)에 걸려 창 끝의 조회 한 번으로 미뤄졌다는 흔적(계약 8.2). 결제사가 보낸 줄이 아니라 서버가 만든 줄이다.
 * 응답에는 `eventKey` 칸이 없어서 `resourceType` 으로 알아본다(`eventType` 은 `LIMIT_REACHED`).
 */
export const LIMIT_MARKER_RESOURCE_TYPE = 'LIMIT_MARKER'

/** 수신함 `resourceId` 가 결제 키 대신 쓰는 주문 표시의 접두사 - `order:<주문 id>` */
export const ORDER_RESOURCE_PREFIX = 'order:'

/** 이 줄의 `resourceId` 가 결제 키가 아니라 주문 표시(`order:…`)인가 - 그 주문에 결제 키가 아직 없다 */
export const isOrderResourceId = (resourceId: string): boolean =>
  resourceId.startsWith(ORDER_RESOURCE_PREFIX)

export const isLimitMarker = (event: Pick<WebhookEvent, 'resourceType'>): boolean =>
  event.resourceType === LIMIT_MARKER_RESOURCE_TYPE
