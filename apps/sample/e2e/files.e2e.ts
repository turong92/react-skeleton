import { expect as pwExpect, type Browser, type Locator, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { USER, commentForm, commentOf, openBoard, signInAs, signOut, writePost } from './boardSteps'
import { dismissConsent, ko, launch } from './helpers'

/*
 * 파일 여정 — 사진을 댓글에 끌어다 놓으면 로컬 미리보기 → 진행률 → 서버 검사(완료 호출) → 글이 공개되면 다른 브라우저 문맥(로그인 없음)에서
 * 썸네일이 srcset 으로 보이고, 공개 객체 바이트에 GPS 가 없다. `.png` 이름의 HTML 파일은 「쓸 수 없는 파일」 문구로 거절된다.
 * 진짜 백엔드(kotlin-skeleton apps/sample: `storage.image.enabled` 켜짐 - 이미지 모듈이 없는 백엔드에서는 이 파일이 실패한다) · 진짜 브라우저.
 * 변환은 작업 큐가 하고 공개 영역 복사는 게시판 맞추기 큐가 다시 시도하며 기다린다 - 분 단위 제한을 준다.
 */
const baseUrl = inject('baseUrl')

let browser: Browser
let page: Page
let postUrl = ''

const TITLE = '사진 시연 글'
const COMMENT = '회전과 위치 정보가 든 사진을 붙인 댓글'
const SECRET = 'GPS-SECRET-MARKER-37.5665N-126.9780E'

beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

/** 브라우저 캔버스로 800x600 JPEG 한 장 - 잡음이 있어 작은 파일이 되지 않는다 */
async function canvasJpeg(on: Page): Promise<Buffer> {
  const base64 = await on.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const context = canvas.getContext('2d')!
    for (let x = 0; x < 800; x += 8)
      for (let y = 0; y < 600; y += 8) {
        context.fillStyle = `rgb(${(x * 3) % 256}, ${(y * 5) % 256}, ${(x + y) % 256})`
        context.fillRect(x, y, 8, 8)
      }
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
  })
  return Buffer.from(base64, 'base64')
}

/** SOI 바로 뒤에 APP1(Exif: 방향 6 = 시계 방향 90도 + GPS 위도) 과 비밀 표식이 든 COM 마디를 끼운다 */
function withRotationAndGps(jpeg: Buffer): Buffer {
  // [바이트 수, 값] 열 - 빅엔디안 TIFF. IFD0(8): 방향 + GPS 포인터(38), GPS IFD(38): 위도 참조 'N' + 위도(68) 37/33/0
  const fields: Array<[2 | 4, number]> = [
    [2, 0x4d4d],
    [2, 0x002a],
    [4, 8], // 'MM' 머리
    [2, 2],
    [2, 0x0112],
    [2, 3],
    [4, 1],
    [2, 6],
    [2, 0], // 방향 = 6
    [2, 0x8825],
    [2, 4],
    [4, 1],
    [4, 38],
    [4, 0], // GPS 포인터
    [2, 2],
    [2, 1],
    [2, 2],
    [4, 2],
    [2, 0x4e00],
    [2, 0], // 위도 참조 = "N"
    [2, 2],
    [2, 5],
    [4, 3],
    [4, 68],
    [4, 0], // 위도 자리
    ...[37, 1, 33, 1, 0, 1].map((v): [2 | 4, number] => [4, v]),
  ]
  const tiff = Buffer.alloc(fields.reduce((sum, [size]) => sum + size, 0))
  let at = 0
  for (const [size, value] of fields) {
    if (size === 2) tiff.writeUInt16BE(value, at)
    else tiff.writeUInt32BE(value, at)
    at += size
  }
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const segment = (marker: number, body: Buffer) =>
    Buffer.concat([
      Buffer.from([0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff]),
      body,
    ])
  return Buffer.concat([
    jpeg.subarray(0, 2),
    segment(0xe1, exif),
    segment(0xfe, Buffer.from(SECRET, 'latin1')),
    jpeg.subarray(2),
  ])
}

/** 파일 고르기 칸에 파일을 끌어다 놓는다(진짜 DragEvent) */
async function dropFile(
  on: Page,
  zone: Locator,
  file: { name: string; type: string; body: Buffer },
) {
  const dataTransfer = await on.evaluateHandle(
    ({ name, type, base64 }) => {
      const transfer = new DataTransfer()
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      transfer.items.add(new File([bytes], name, { type }))
      return transfer
    },
    { name: file.name, type: file.type, base64: file.body.toString('base64') },
  )
  await zone.dispatchEvent('dragover', { dataTransfer })
  await zone.dispatchEvent('drop', { dataTransfer })
}

const pickerOf = (on: Page) =>
  commentForm(on).getByRole('group', { name: ko('board.pictures.pickTitle') })

describe('Files — drop a photo, server check, public thumbnail without location data', () => {
  it('a member writes a post and drops a rotated, GPS-tagged JPEG on the comment: preview, progress, then attached', async () => {
    await signInAs(page, baseUrl, USER)
    await openBoard(page)
    await writePost(page, TITLE, '사진을 댓글에 붙여요.')
    postUrl = page.url()
    // 저장소로 가는 PUT 을 잠깐 붙잡아 진행률 막대가 보이는 동안을 만든다
    await page.route(
      (url) => url.searchParams.has('X-Amz-Signature'),
      async (route) => {
        if (route.request().method() === 'PUT') await new Promise((r) => setTimeout(r, 1500))
        await route.continue()
      },
    )
    await page.getByRole('textbox', { name: ko('board.comments.newComment') }).fill(COMMENT)
    const photo = withRotationAndGps(await canvasJpeg(page))
    await dropFile(page, pickerOf(page), { name: 'trip.jpg', type: 'image/jpeg', body: photo })
    await pwExpect(commentForm(page).getByRole('img', { name: 'trip.jpg' })).toBeVisible() // 로컬 미리보기
    await pwExpect(commentForm(page).getByRole('progressbar')).toBeVisible()
    // 올리기가 끝난 칸에만 data-state="done" 이 있다 - 진행률 막대는 실패해도 사라지므로 이것으로 성공을 가린다
    await pwExpect(commentForm(page).locator('li[data-state="done"]')).toBeVisible({
      timeout: 30_000,
    })
    await pwExpect(commentForm(page).getByRole('alert')).toHaveCount(0)
    await pwExpect(commentForm(page).getByRole('progressbar')).toHaveCount(0)
  })

  it('a .png that is really HTML is refused by the server with the "cannot be used" sentence, and nothing is attached', async () => {
    const html = Buffer.from('<!doctype html><html><body><script>alert(1)</script></body></html>')
    await dropFile(page, pickerOf(page), { name: 'evil.png', type: 'image/png', body: html })
    await pwExpect(commentForm(page).getByRole('alert')).toContainText('쓸 수 없는 파일', {
      timeout: 30_000,
    })
    await commentForm(page)
      .getByRole('button', { name: `evil.png ${ko('board.pictures.remove')}` })
      .click()
    await pwExpect(commentForm(page).getByRole('alert')).toHaveCount(0)
  })

  it('posting the comment makes the photo public once converted: a signed-out visitor sees the thumbnail as a srcset, with no GPS in the bytes', async () => {
    await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(page.locator('[data-status] > p').filter({ hasText: COMMENT })).toBeVisible()
    await signOut(page)

    const visitor = await (await browser.newContext({ locale: 'ko-KR' })).newPage()
    visitor.context().setDefaultTimeout(15_000)
    try {
      await visitor.goto(postUrl)
      await dismissConsent(visitor)
      await pwExpect(visitor.getByRole('heading', { level: 2, name: TITLE })).toBeVisible()
      // 변환 중이면 「처리 중」, 끝나면 공개 사본 - 이 화면이 스스로 다시 읽는다. 공개 복사는 게시판 맞추기 큐가 다시 시도하므로 분 단위로 기다린다
      const picture = commentOf(visitor, COMMENT).getByRole('img')
      await pwExpect(picture).toBeVisible({ timeout: 240_000 })
      pwExpect(await picture.getAttribute('srcset')).toMatch(/ 300w, \S+ 600w$/)
      // 방향 6(회전)이 픽셀에 반영돼 폭 600 · 높이 800 으로 자리가 잡힌다
      await pwExpect(picture).toHaveAttribute('width', '600')
      await pwExpect(picture).toHaveAttribute('height', '800')
      await pwExpect
        .poll(() => picture.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
        .toBe(true)
      // 받은 공개 객체(표시본 · 썸네일)에는 Exif 도 위치 표식도 없다
      const srcSet = (await picture.getAttribute('srcset')) ?? ''
      const urls = [
        (await picture.getAttribute('src')) ?? '',
        ...srcSet.split(',').map((c) => c.trim().split(' ')[0]),
      ]
      for (const url of new Set(urls)) {
        const body = (await visitor.request.get(new URL(url, postUrl).toString())).body()
        const text = (await body).toString('latin1')
        pwExpect(text).not.toContain('Exif')
        pwExpect(text).not.toContain(SECRET)
      }
    } finally {
      await visitor.context().close()
    }
  })
})
