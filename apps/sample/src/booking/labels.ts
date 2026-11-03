import { defaultBookingLabels, koBookingLabels, type BookingLabels } from '@skeleton/booking'
import {
  defaultBookingAdminLabels,
  koBookingAdminLabels,
  type BookingAdminLabels,
} from '@skeleton/booking/admin'
import { defaultWaitingRoomLabels, koWaitingRoomLabels } from '@skeleton/waiting-room'

export const bookingLabelsFor = (language: 'ko' | 'en'): BookingLabels =>
  language === 'ko' ? koBookingLabels : defaultBookingLabels

export const bookingAdminLabelsFor = (language: 'ko' | 'en'): BookingAdminLabels =>
  language === 'ko' ? koBookingAdminLabels : defaultBookingAdminLabels

export const waitingRoomLabelsFor = (language: 'ko' | 'en') =>
  language === 'ko' ? koWaitingRoomLabels : defaultWaitingRoomLabels
