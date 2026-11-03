import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { koBookingLabels } from '@skeleton/booking'
import { koWaitingRoomLabels } from '@skeleton/waiting-room'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { ko, launch, signIn } from './helpers'
import { ADMIN, api, ensureSignedIn, tokenOf } from './paymentSteps'

/*
 * 예약 여정 — 대기실 → 입장 → 자리 찍기(잡힘) → 다시 누르기(놓기) → 다시 잡기 → 결제 시작(결제 자리). 진짜 백엔드(`booking` · `waiting-room`) + 진짜 브라우저.
 * 결제는 시작에서 멈춘다 - 결제창을 열지 않고 돈이 움직이지 않는다(결제사 연동은 `payment.e2e.ts` 가 가짜 토스로 본다).
 * 준비: 운영자 경로(`/admin/waiting-rooms` · `/admin/booking/pools`, 로컬 프로필이 켠다)로 몇 초 뒤 열리는 대기실 · 풀을 새로 만든다 - 시계를 건드리지 않고 「오픈 전 줄」을 본다.
 * 둘째 계정(운영자 시드 계정)이 같은 배치도를 다른 브라우저 문맥으로 본다: A 가 잡으면 B 의 배치도가 새로고침 없이 「선택 불가」,
 * B 가 (흐름이 끊긴 사이라 늦게 본 화면으로) 눌러 「먼저 잡았어요」, A 가 놓으면 B 에서 다시 열린다.
 * 예약이 없는 백엔드(운영자 경로 404)에서는 통째로 건너뛴다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const OPENS_IN_MS = 10_000
/** 오픈 → 섞기 → 분당 60명 입장까지 */
const ADMISSION_WAIT_MS = 60_000

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

/** 이 백엔드에 예약 운영자 경로가 있는가 - 404 만 「없다」 */
async function bookingOn(token: string): Promise<boolean> {
  const answer = await api(apiUrl, token, 'GET', '/admin/booking/pools')
  if (answer.status === 200) return true
  if (answer.status === 404) return false
  throw new Error(`GET /admin/booking/pools → ${answer.status}`)
}

/** 몇 초 뒤 열리는 대기실 + 유료 풀(R석 4개, 한 번에 2석) - 풀 id */
async function openingPool(token: string): Promise<string> {
  const opensAt = new Date(Date.now() + OPENS_IN_MS).toISOString()
  const scopeKey = `e2e-${Date.now()}`
  const room = await api(apiUrl, token, 'POST', '/admin/waiting-rooms', {
    scopeKey,
    opensAt,
    prequeueMinutes: 5,
    perMinute: 60,
  })
  if (room.status !== 200 && room.status !== 201) throw new Error(`create room → ${room.status}`)
  const pool = await api(apiUrl, token, 'POST', '/admin/booking/pools', {
    name: `E2E ${scopeKey}`,
    opensAt,
    maxPerHold: 2,
    currency: 'KRW',
    waitingRoomId: room.json.value.id,
  })
  if (pool.status !== 200 && pool.status !== 201) throw new Error(`create pool → ${pool.status}`)
  const id = pool.json.value.id as string
  const seats = await api(apiUrl, token, 'POST', `/admin/booking/pools/${id}/seats`, {
    seats: [1, 2, 3, 4].map((number) => ({
      section: 'A',
      row: '1',
      number,
      grade: 'R',
      price: 30_000,
    })),
  })
  if (seats.status !== 200 && seats.status !== 201) throw new Error(`add seats → ${seats.status}`)
  return id
}

const seat = (target: Page, number: number) =>
  target.getByRole('button', { name: new RegExp(`^A구역 1열 ${number}번 `) })

describe('booking journey', () => {
  it('waits in the room, enters, holds a seat, lets it go by pressing again, holds again and starts the payment', async (ctx) => {
    const admin = await tokenOf(apiUrl, ADMIN)
    if (!(await bookingOn(admin))) return ctx.skip()
    const poolId = await openingPool(admin)
    await tokenOf(apiUrl) // 체험 계정의 약관 동의를 미리 해 둔다(동의 화면이 길을 막지 않게)
    await ensureSignedIn(page, baseUrl)

    // 대기실: 오픈 전 줄 → 입장하면 배치도
    await page.goto(`${baseUrl}/booking/${poolId}`)
    await pwExpect(page.getByText(koWaitingRoomLabels.screen.prequeueTitle)).toBeVisible()
    const first = seat(page, 1)
    await baseExpect(first).toBeVisible({ timeout: ADMISSION_WAIT_MS })
    await baseExpect(first).toHaveAttribute('aria-pressed', 'false')

    // 찍으면 잡힌다 - 내 자리 + 내가 고른 자리 칸
    await first.click()
    await pwExpect(first).toHaveAttribute('aria-pressed', 'true')
    const hold = page.getByRole('list').filter({ hasText: 'A구역 1열 1번 (R석)' })
    await pwExpect(hold).toBeVisible()
    await pwExpect(page.getByRole('timer')).toBeVisible()

    // 다시 누르면 놓는다
    await first.click()
    await pwExpect(first).toHaveAttribute('aria-pressed', 'false')
    await pwExpect(page.getByText(koBookingLabels.hold.empty)).toBeVisible()

    // 다시 잡고 결제 시작 - 자리는 고정되고 결제 자리가 열린다
    await first.click()
    await pwExpect(first).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: koBookingLabels.hold.checkout, exact: true }).click()
    await pwExpect(page.getByText(koBookingLabels.hold.locked)).toBeVisible()
    await pwExpect(page.getByRole('button', { name: ko('booking.pay.open') })).toBeVisible()

    // 나가기 - 자리가 풀린다
    await page.getByRole('button', { name: koBookingLabels.hold.leave, exact: true }).click()
    await pwExpect(first).toHaveAttribute('aria-pressed', 'false')

    // 계정 둘 - B 는 다른 브라우저 문맥(운영자 시드 계정)으로 같은 배치도에 들어온다
    const other = await launch()
    try {
      const guest = other.page
      await signIn(guest, baseUrl, ADMIN)
      await guest.goto(`${baseUrl}/booking/${poolId}`)
      const theirFirst = seat(guest, 1)
      const theirSecond = seat(guest, 2)
      await baseExpect(theirFirst).toBeVisible({ timeout: ADMISSION_WAIT_MS })
      await pwExpect(theirFirst).toBeEnabled()

      // A 가 잡으면 B 의 배치도에서 새로고침 없이 선택 불가
      await first.click()
      await pwExpect(first).toHaveAttribute('aria-pressed', 'true')
      await pwExpect(theirFirst).toBeDisabled()

      // 둘째 자리를 A 와 B 가 동시에 누른다 - 서버(DB)가 한쪽만 잡히게 하고, 진 쪽은 「먼저 잡았어요」를 받는다
      const mine = seat(page, 2)
      // 단추가 눌리는 걸 기다리지 않고 바로 보낸다(기다리는 사이 서버 사건이 먼저 닿아 단추가 잠긴다)
      await Promise.all([mine.dispatchEvent('click'), theirSecond.dispatchEvent('click')])
      await pwExpect(async () => {
        const pressed = await Promise.all(
          [mine, theirSecond].map((s) => s.getAttribute('aria-pressed')),
        )
        baseExpect(pressed.filter((value) => value === 'true')).toHaveLength(1)
      }).toPass()
      const loser = (await mine.getAttribute('aria-pressed')) === 'true' ? guest : page
      await pwExpect(loser.getByText(koBookingLabels.problems.seatTaken)).toBeVisible()

      // A 가 첫 자리를 놓으면 B 에서 다시 열린다
      await first.click()
      await pwExpect(first).toHaveAttribute('aria-pressed', 'false')
      await pwExpect(theirFirst).toBeEnabled()
    } finally {
      await other.browser.close()
    }
  }, 240_000)
})
