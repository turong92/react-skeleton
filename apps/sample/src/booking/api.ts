import { createAuthHeadersProvider } from '@skeleton/auth'
import { createBookingApi, type SeatStreamOptions } from '@skeleton/booking'
import { createBookingAdminApi } from '@skeleton/booking/admin'
import { createWaitingRoomApi } from '@skeleton/waiting-room'
import { apiClient } from '../api/client'
import { emailRequired } from '../api/emailRequired'
import { subscribeGateRelease } from '../api/gateRelease'
import { loginIdRequired } from '../api/loginIdRequired'
import { reconsent } from '../api/reconsent'
import { refresher } from '../auth/refresher'
import { tokenStore } from '../auth/tokenStore'

/** 예약 호출 - 백엔드 `booking` · `booking-jdbc` 가 여는 `/api/v1/booking`. 풀 하나 읽기는 공개, 자리 · 보류는 로그인 */
export const bookingApi = createBookingApi(apiClient)

/** 운영 호출 - `skeleton.booking.admin.enabled=true`(로컬 프로필이 켠다) + 권한 `booking.read` · `booking.manage`, 경로 `/api/v1/admin/booking/pools` */
export const bookingAdminApi = createBookingAdminApi(apiClient)

/** 대기실 호출 - 백엔드 `waiting-room` · `waiting-room-jdbc` 의 `/api/v1/waiting-rooms`. 로그인한 사람만 줄을 선다 */
export const waitingRoomApi = createWaitingRoomApi(apiClient)

const getAuthHeaders = createAuthHeadersProvider(tokenStore)

/**
 * 배치도 흐름(SSE)의 로그인 헤더 · 401 복구 - 알림 흐름(`notifications/useLiveNotifications`)과 같은 것이다.
 * 입장권 헤더는 `@skeleton/booking` 이 붙인다
 */
export const bookingSse: NonNullable<SeatStreamOptions['sse']> = {
  getAuthHeaders,
  recoverUnauthorized: (failed) => refresher.refresh(failed),
  subscribeAuthChanges: (onChange) => {
    const offToken = tokenStore.subscribe(onChange)
    const offGates = subscribeGateRelease([loginIdRequired, emailRequired, reconsent], onChange)
    return () => {
      offToken()
      offGates()
    }
  },
}
