import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Locator, Page } from 'playwright'
import { describe, inject, it } from 'vitest'
import { routeTossSdk } from './fakeToss'
import { launch } from './helpers'
import { api, ensureSignedIn, labels, resultTitle, tokenOf } from './paymentSteps'

/*
 * 구독 증거 - 진짜 백엔드 · 가짜 토스로 플랜 목록 → 카드 등록 → 첫 결제 결과 → 내 구독 → 해지 예약 확인 창 → 해지 예약된 상태를 밟으며 스크린샷을 남긴다:
 * 1280px 다섯 장 + 375px 세 장(플랜 목록 · 내 구독 · 확인 창), 그리고 320px 에서 세 화면이 가로로 밀리지 않는지 잰다.
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample walkthrough` (구독이 없는 백엔드면 건너뛴다). `captions.md` 에 파일 → 한 줄 설명.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeTossUrl = inject('fakeTossUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []
const mine = labels.subscription.mine

async function shot(page: Page, file: string, caption: string, target?: Locator) {
  await page.waitForTimeout(600)
  if (target) await target.screenshot({ path: join(out, file) })
  else await page.screenshot({ path: join(out, file), fullPage: true })
  captions.push([file, caption])
}

const overflows = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

describe('subscription walkthrough', () => {
  it('captures plans, the card result, my subscription, the cancel dialog and the reserved end, desktop and phone', async (ctx) => {
    if (!fakeTossUrl) return ctx.skip()
    const token = await tokenOf(apiUrl)
    if ((await api(apiUrl, token, 'GET', '/payments/subscriptions/plans')).status !== 200)
      return ctx.skip()
    mkdirSync(out, { recursive: true })
    const { browser, context, page } = await launch()
    await routeTossSdk(context, fakeTossUrl)
    try {
      await ensureSignedIn(page, baseUrl)

      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(`${baseUrl}/subscribe`)
      await page.getByRole('button', { name: /구독하기.*베이직/ }).waitFor()
      await shot(
        page,
        '01-plans.png',
        '플랜 목록 - 카드마다 채운 「구독하기」 단추 하나, 금액 · 주기는 글자로 (1280px)',
      )
      await page.setViewportSize({ width: 375, height: 800 })
      await shot(
        page,
        '06-plans-375.png',
        '플랜 목록 (375px) - 카드가 한 줄로 쌓이고 가로로 밀리지 않는다',
      )
      await page.setViewportSize({ width: 1280, height: 900 })

      await page.getByRole('button', { name: /구독하기.*스탠다드/ }).click()
      await page.waitForURL(/\/subscriptions\/return\?/)
      await resultTitle(page, labels.result.paid.title).waitFor()
      await shot(
        page,
        '02-result.png',
        '카드 등록 창에서 돌아와 첫 결제가 끝난 결과 - 「결제됨」 (1280px)',
      )

      await page.goto(`${baseUrl}/subscription`)
      await page.getByText(mine.nextPayment).first().waitFor()
      await shot(
        page,
        '03-mine.png',
        '내 구독 - 플랜 · 「구독 중」 알약 · 금액 · 다음 결제일 · 카드 끝 네 자리 · 최근 결제 · 채운 「해지 예약」 단추 (1280px)',
      )
      await page.setViewportSize({ width: 375, height: 800 })
      await shot(page, '07-mine-375.png', '내 구독 (375px)')
      await page.setViewportSize({ width: 1280, height: 900 })

      await page.getByRole('button', { name: mine.cancel, exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await shot(
        page,
        '04-cancel-dialog.png',
        '해지 예약 확인 대화상자 - 「○까지 계속 이용할 수 있고 그 뒤에는 결제되지 않아요」 (1280px)',
      )
      await page.setViewportSize({ width: 375, height: 800 })
      await shot(page, '08-cancel-dialog-375.png', '해지 예약 확인 대화상자 (375px)')
      await page.setViewportSize({ width: 1280, height: 900 })

      await dialog.getByRole('button', { name: labels.subscription.cancelDialog.confirm }).click()
      await dialog.waitFor({ state: 'hidden' })
      await page.getByText(labels.subscription.status.CANCELING).first().waitFor()
      await shot(
        page,
        '05-canceling.png',
        '해지 예약된 상태 - 「해지 예약됨」 알약과 「○에 끝나요」 (1280px)',
      )

      // 320px - 세 화면이 가로로 밀리지 않는다
      await page.setViewportSize({ width: 320, height: 700 })
      for (const path of ['/subscribe', '/subscription', '/subscriptions/return?sub=none']) {
        await page.goto(`${baseUrl}${path}`)
        await page.getByRole('heading', { level: 1 }).first().waitFor()
        await page.waitForTimeout(400)
        if (await overflows(page)) throw new Error(`${path} pushes sideways at 320px`)
      }
      captions.push([
        '(측정)',
        '320px 에서 /subscribe · /subscription · /subscriptions/return 이 가로로 밀리지 않는다',
      ])
    } finally {
      await browser.close()
      writeFileSync(
        join(out, 'captions.md'),
        captions.map(([file, text]) => `- \`${file}\` - ${text}`).join('\n') + '\n',
      )
    }
  }, 180_000)
})
