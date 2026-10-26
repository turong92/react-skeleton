import type { DashboardLabels } from './labels'
import type { DashboardStatus } from './types'

/** 숫자를 못 보여 줄 때의 안내 상자 - 상태마다 문구가 다르다(키 없음은 출처별 안내) */
export function statusMessage(
  status: DashboardStatus,
  source: string,
  labels: Pick<DashboardLabels, 'status'>,
): string | null {
  switch (status) {
    case 'OK':
      return null
    case 'NOT_CONNECTED':
      return labels.status.notConnected[source] ?? labels.status.notConnected['*']
    case 'NO_HISTORY':
      return labels.status.noHistory
    case 'ERROR':
      return labels.status.error
  }
}
