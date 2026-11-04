import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect as pwExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { MODERATOR } from './boardSteps'
import { DEMO, accessTokenFor, ko, launch, seedNotes, signIn } from './helpers'

/*
 * 영상 여정 — 노트에 비공개 영상 하나: 합성 HEVC 1080p 세로 영상(ffmpeg) → 올리기 진행률 → 재생 가능(원본 단) → 호환 · 사다리 준비 →
 * 자동 재생이 마스터(세로 유지) → 노트 제목만 고쳐도 영상이 남는다 → 다른 계정은 404.
 * 진짜 백엔드(kotlin-skeleton apps/sample + 로컬 영상 일꾼 - `APP=sample scripts/dev.sh` 가 올리는 것. 일꾼이 없으면 「재생할 수 있어요」에서 멈춘다) · 진짜 브라우저.
 * 이 파일만 돌리려면: E2E_API_URL=http://localhost:8080 pnpm e2e video.e2e.ts (이미 떠 있는 백엔드를 쓰고, 내리지도 않는다). ffmpeg 가 PATH 에 있어야 한다.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')

let browser: Browser
let page: Page
let clip = ''
let tmp = ''
let noteId = ''
let videoId = ''

const NOTE_TITLE = '영상 여정 노트'

beforeAll(async () => {
  // 1080x1920(세로) HEVC, 소리 있음, 4초 - hvc1 태그가 있어야 mp4 에서 코덱이 보인다
  tmp = mkdtempSync(join(tmpdir(), 'e2e-video-'))
  clip = join(tmp, 'portrait-hevc.mp4')
  execFileSync(
    'ffmpeg',
    [
      ...['-v', 'error', '-y'],
      ...['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=4'],
      ...['-f', 'lavfi', '-i', 'sine=frequency=440:duration=4'],
      ...['-c:v', 'libx265', '-preset', 'ultrafast', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p'],
      ...['-x265-params', 'log-level=error'],
      ...['-c:a', 'aac', '-shortest', '-movflags', '+faststart', clip],
    ],
    { stdio: 'inherit' },
  )
  ;[{ id: noteId }] = await seedNotes(apiUrl, [{ title: NOTE_TITLE, body: '영상 하나를 붙인다' }])
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
  if (tmp) rmSync(tmp, { recursive: true, force: true })
})

type Item = { id: string; status: string; compat: string; ladder: string; width: number | null }

async function api(token: string, path: string, init: RequestInit = {}) {
  return fetch(`${apiUrl}/api/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

async function listVideos(token: string): Promise<Item[]> {
  const response = await api(token, '/videos?purpose=note')
  return ((await response.json()) as { values?: Item[]; value?: Item[] }).values ?? []
}

async function until<T>(what: string, read: () => Promise<T | undefined>, ms: number): Promise<T> {
  const deadline = Date.now() + ms
  for (;;) {
    const value = await read()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 2_000))
  }
}

const openVideoTab = async () => {
  await page.goto(`${baseUrl}/notes/${noteId}`)
  await page.getByRole('tab', { name: ko('detail.tabVideo') }).click()
}

describe('Notes — one private video, from upload to playback', () => {
  it('uploads a portrait HEVC clip with a progress bar, then it is playable from the original track', async () => {
    await signIn(page, baseUrl)
    // 올리는 동안을 눈으로 볼 수 있게 저장소로 가는 조각 PUT 을 잠깐 붙잡는다(작은 파일은 순식간에 끝난다)
    await page.route(/:\d+\/app\/.*\?.*partNumber=/, async (route) => {
      await new Promise((r) => setTimeout(r, 1_500))
      await route.continue()
    })
    await openVideoTab()
    await page.getByRole('tabpanel').locator('input[type="file"]').setInputFiles(clip)
    await pwExpect(page.getByRole('progressbar').first()).toBeVisible()
    await pwExpect(page.getByText(/%/).first()).toBeVisible()
    await page.unroute(/:\d+\/app\/.*\?.*partNumber=/)

    // 원본 단이 올라간 순간 「재생할 수 있어요」 - 호환 · 사다리 판은 아직 만드는 중일 수 있다
    await pwExpect(page.getByText('재생할 수 있어요')).toBeVisible({ timeout: 180_000 })
    // 같은 화면에서 호환판이 준비되면 막혀 있던 재생 단추가 풀린다(HEVC 원본은 이 브라우저가 못 튼다) - 새로 열지 않는다
    await pwExpect(page.getByRole('button', { name: /^영상 재생/ })).toBeEnabled({
      timeout: 180_000,
    })

    // 노트에 붙었다 - 새로 고쳐도 남는다
    const token = await accessTokenFor(apiUrl, DEMO, { strict: true })
    const note = (await (await api(token!, `/notes/${noteId}`)).json()) as {
      value: { videoId: string | null }
    }
    expect(note.value.videoId).toBeTruthy()
    videoId = note.value.videoId!
  })

  it('finishes the compatible and ladder tracks, and the field stops saying it is still preparing', async () => {
    const token = (await accessTokenFor(apiUrl, DEMO, { strict: true }))!
    const done = await until(
      'compat READY and ladder READY|SKIPPED',
      async () => {
        const item = (await listVideos(token)).find((v) => v.id === videoId)
        if (item?.status === 'FAILED') throw new Error(`video failed: ${JSON.stringify(item)}`)
        return item?.compat === 'READY' && ['READY', 'SKIPPED'].includes(item.ladder)
          ? item
          : undefined
      },
      420_000,
    )
    expect(done.status).toBe('PLAYABLE')
    expect(done.width).toBe(1080)
    await openVideoTab()
    await pwExpect(page.getByText('재생할 수 있어요')).toBeVisible()
    await pwExpect(page.getByText('다른 기기용 판 준비 중')).toHaveCount(0)
  })

  it('plays the master automatically and keeps the picture portrait', async () => {
    const token = (await accessTokenFor(apiUrl, DEMO, { strict: true }))!
    const grant = (
      (await (await api(token, `/videos/${videoId}/playback`, { method: 'POST' })).json()) as {
        value: { hls?: string; compat?: string; src: string; w: number; h: number }
      }
    ).value
    expect(grant.hls, 'the master playlist is offered once the tracks are ready').toBeTruthy()
    expect(grant.h).toBeGreaterThan(grant.w)

    await openVideoTab()
    const master = page.waitForRequest((request) => request.url().includes(masterFile(grant.hls!)))
    await page.getByRole('button', { name: /^영상 재생/ }).click()
    await master
    const video = page.locator('video')
    await pwExpect(video).toBeVisible()
    await pwExpect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 60_000 })
      .toBeGreaterThan(0.5)
    const size = await video.evaluate((v: HTMLVideoElement) => ({
      w: v.videoWidth,
      h: v.videoHeight,
      error: v.error?.code ?? null,
    }))
    expect(size.error).toBeNull()
    expect(size.h).toBeGreaterThan(size.w) // 세로 유지
    // 화질 칩은 「자동」(마스터)이다
    await pwExpect(page.getByRole('button', { name: /^화질: 자동/ })).toBeVisible()
  })

  it('keeps the video when only the note title is edited', async () => {
    await page.goto(`${baseUrl}/notes/${noteId}/edit`)
    const title = page.getByLabel(ko('form.title'), { exact: false }).first()
    await title.fill(`${NOTE_TITLE} (고침)`)
    await page.getByRole('button', { name: ko('form.submitEdit') }).click()
    await page.waitForURL(new RegExp(`/notes/${noteId}$`))
    const token = (await accessTokenFor(apiUrl, DEMO, { strict: true }))!
    const note = (await (await api(token, `/notes/${noteId}`)).json()) as {
      value: { videoId: string | null; title: string }
    }
    expect(note.value.title).toContain('(고침)')
    expect(note.value.videoId).toBe(videoId)
    expect((await listVideos(token)).some((v) => v.id === videoId && v.status === 'PLAYABLE')).toBe(
      true,
    )
  })

  it('answers 404 to another account for the playback permit and for removal', async () => {
    const other = (await accessTokenFor(apiUrl, MODERATOR, { strict: true }))!
    expect((await api(other, `/videos/${videoId}/playback`, { method: 'POST' })).status).toBe(404)
    expect((await api(other, `/videos/${videoId}`, { method: 'DELETE' })).status).toBe(404)
    expect((await listVideos(other)).some((v) => v.id === videoId)).toBe(false)
  })
})

/** 마스터 재생 목록의 파일 이름(경로 끝 두 칸) - 출입증 토큰이 새로 발급돼도 같다 */
const masterFile = (url: string) => new URL(url, 'http://x').pathname.split('/').slice(-2).join('/')
