import type { ApiClient, ApiCursorResponse } from '@skeleton/api-client'
import type { AttendanceMonth, Campaign, CheckInResult, Invitee, ReferralMe } from '../types'

export type CampaignApi = {
  /** `GET {campaigns}` — 진행 중인 이벤트와 내 상태 */
  listCampaigns(): Promise<Campaign[]>
  /** `POST {campaigns}/{id}/attendance` — 끝난 · 꺼진 이벤트는 409 `CAMPAIGN.NOT_ACTIVE` */
  checkIn(campaignId: string): Promise<CheckInResult>
  /** `GET {campaigns}/{id}/attendance?month=2026-10` */
  attendanceMonth(campaignId: string, month: string): Promise<AttendanceMonth>
  /** `GET {referrals}/me` */
  myReferral(): Promise<ReferralMe>
  /** `GET {referrals}/me/invitees?cursor&size` — 내가 초대한 사람들, 새것부터. 첫 쪽은 cursor 없이 */
  myInvitees(cursor?: string, size?: number): Promise<ApiCursorResponse<Invitee>>
  /** `POST {referrals}/claim {code}` — 204, 안 되면 400 `CAMPAIGN.REFERRAL_INVALID`(이유는 `data.reason` — `referralRejection`) · 409 `CAMPAIGN.NOT_ACTIVE` */
  claimReferral(code: string): Promise<void>
}

export type CampaignApiPaths = {
  /** 기본 `/campaigns` */
  campaigns?: string
  /** 기본 `/referrals` */
  referrals?: string
}

const trim = (path: string) => path.replace(/\/+$/, '')

export function createCampaignApi(
  client: Pick<ApiClient, 'list' | 'value' | 'noContent' | 'cursor'>,
  { campaigns = '/campaigns', referrals = '/referrals' }: CampaignApiPaths = {},
): CampaignApi {
  const events = trim(campaigns)
  const invites = trim(referrals)
  const enc = encodeURIComponent
  return {
    listCampaigns: () => client.list<Campaign>(events),
    checkIn: (id) =>
      client.value<CheckInResult>(`${events}/${enc(id)}/attendance`, { method: 'POST' }),
    attendanceMonth: (id, month) =>
      client.value<AttendanceMonth>(`${events}/${enc(id)}/attendance`, { params: { month } }),
    myReferral: () => client.value<ReferralMe>(`${invites}/me`),
    myInvitees: (cursor, size) =>
      client.cursor<Invitee>(`${invites}/me/invitees`, {
        params: {
          ...(cursor === undefined ? {} : { cursor }),
          ...(size === undefined ? {} : { size }),
        },
      }),
    claimReferral: (code) =>
      client.noContent(`${invites}/claim`, { method: 'POST', json: { code } }),
  }
}
