import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect as pwExpect, type Page } from 'playwright/test'
import { describe, inject, it } from 'vitest'
import { strings } from '../src/strings'
import {
  MODERATOR,
  USER,
  article,
  commentOf,
  openBoard,
  openPost,
  postComment,
  reaction,
  replyTo,
  seedPosts,
  signInAs,
  signOut,
  writePost,
} from './boardSteps'
import { launch } from './helpers'

/*
 * 게시판 증거 — 같은 서버 · 같은 계정으로 글 목록 → 글 + 반응(좋아요 · 공감) → 댓글 · 대댓글 · 접힘 → 운영자의 숨김 → 다크 · 모바일을 사람이 보는 속도로 밟아
 * 스크린샷(+ 녹화 `board-journey.webm`)과 `captions-board.md` 를 남긴다. `walkthrough.shots.ts`(Notes)와 한 번에 돈다:
 * `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample walkthrough`  (테스트가 아니다 — `pnpm e2e` 에는 들어가지 않는다)
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const t = strings.board

const captions: Array<[string, string]> = []
async function shot(page: Page, file: string, caption: string, fullPage = false) {
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(out, file), fullPage })
  captions.push([file, caption])
}

describe('walkthrough — board', () => {
  it('walks the board journey and saves the evidence', async () => {
    mkdirSync(out, { recursive: true })
    await seedPosts(apiUrl, USER, [
      {
        title: '게시판 이용 안내',
        body: '서로 존중하며 이야기해요. 반응 단추로 마음을 표현할 수 있어요.',
      },
      { title: '이번 주 모임 장소 투표', body: '강남 · 홍대 · 성수 중에 어디가 좋을까요?' },
      { title: '추천해 주세요: 입문용 키보드', body: '예산은 10만 원 안쪽이에요.' },
    ])
    const { browser, context, page } = await launch({ recordVideoDir: join(out, '_video-board') })
    try {
      await signInAs(page, baseUrl, USER)
      await openBoard(page)
      await page.getByRole('table', { name: t.list.caption }).waitFor()
      await shot(
        page,
        'b01-board-list.png',
        '게시판 목록 — 정렬 · 검색 · 쪽 이동, 고정 글 표시, 댓글 · 반응 · 조회 수. PostList(@skeleton/board) + Patterns/List page',
      )

      await writePost(page, '점심 뭐 먹지', '회사 근처에서 먹을 곳을 추천해 주세요.')
      await reaction(article(page), 'LIKE', 0).click()
      await reaction(article(page), 'EMPATHY', 0).click()
      await pwExpect(reaction(article(page), 'EMPATHY', 1)).toHaveAttribute('aria-pressed', 'true')
      await shot(
        page,
        'b02-post-reaction.png',
        '글 상세 — 반응 줄은 서버가 알려 준 종류(좋아요 · 싫어요 · 공감)를 그대로 그린다. 「공감」은 라벨 맵 한 줄이고 코드 변경은 없다. ReactionBar',
      )

      await postComment(page, '저는 국밥이 좋아요')
      await replyTo(page, '저는 국밥이 좋아요', '국밥 어디가 맛있나요?')
      await replyTo(page, '국밥 어디가 맛있나요?', '역 앞 골목 안쪽이요')
      await reaction(commentOf(page, '저는 국밥이 좋아요'), 'LIKE', 0).click()
      await page.reload()
      await page.getByRole('button', { name: t.comments.showReplies(1) }).waitFor()
      await shot(
        page,
        'b03-comments-collapsed.png',
        '댓글 · 대댓글 — 깊이 2 의 답글은 「답글 N개 더 보기」 뒤에 접힌다(collapseFromDepth). 댓글에도 같은 반응 줄. CommentThread',
        true,
      )
      await page.getByRole('button', { name: t.comments.showReplies(1) }).click()
      await shot(
        page,
        'b04-comments-expanded.png',
        '접힌 답글을 펼친 모습 — 트리는 서버가 평평하게 준 자손에서 nestThread 가 만든다',
        true,
      )

      await page.emulateMedia({ colorScheme: 'dark' })
      await shot(
        page,
        'b05-post-dark.png',
        '[다크] 같은 글 — 반응 줄 · 댓글 트리가 의미 토큰만으로 다크에서도 AA 대비를 지킨다',
        true,
      )
      await page.emulateMedia({ colorScheme: 'light' })

      await signOut(page)
      await signInAs(page, baseUrl, MODERATOR)
      await openBoard(page)
      await openPost(page, '점심 뭐 먹지')
      await commentOf(page, '국밥 어디가 맛있나요?')
        .getByRole('button', { name: new RegExp(`^${t.comments.hide}: `) })
        .first()
        .click()
      await page.getByText(t.comments.hidden).waitFor()
      await shot(
        page,
        'b06-moderator.png',
        '운영자(config.canModerate) — 글 고정 · 숨김 단추와 댓글 「숨기기」. 숨긴 댓글은 본문 대신 안내 문구가 자리를 지킨다',
        true,
      )

      await page.setViewportSize({ width: 390, height: 844 })
      await shot(
        page,
        'b07-post-mobile.png',
        '[덤] 390px 폭 — 반응 줄이 줄바꿈되고 댓글 들여쓰기는 좁게',
        true,
      )
      await page.setViewportSize({ width: 1280, height: 800 })
      await signOut(page)
    } finally {
      const video = page.video()
      await context.close()
      await browser.close()
      const webm = await video?.path()
      if (webm) {
        const base = join(out, 'board-journey')
        copyFileSync(webm, `${base}.webm`)
        if (spawnSync('ffmpeg', ['-version']).status === 0)
          spawnSync('ffmpeg', [
            '-y',
            '-i',
            `${base}.webm`,
            '-movflags',
            '+faststart',
            '-pix_fmt',
            'yuv420p',
            `${base}.mp4`,
          ])
      }
      const sorted = [...captions].sort(([a], [b]) => a.localeCompare(b))
      writeFileSync(
        join(out, 'captions-board.md'),
        `# 게시판 — 증거\n\n파일 → 캡션. \`board-journey.webm\`/\`.mp4\` 는 같은 여정의 녹화.\n\n${sorted.map(([f, c]) => `- \`${f}\` — ${c}`).join('\n')}\n`,
      )
    }
  }, 280_000)
})
