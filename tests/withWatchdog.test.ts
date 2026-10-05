/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { REPO } from './support/loadWorkspaces'

/*
 * scripts/with-watchdog.mjs — rolldown(rc) 교착처럼 "0% CPU 로 영원히 멈추는" 빌드·테스트를 시간으로 끊고 다시 돈다.
 * 진짜 자식 프로세스로 검증한다(모킹 없음): 멈춤 → 죽임 → 재시도 → 종료 코드 전달, 진짜 실패 → 재시도 없이 그대로.
 */
const SCRIPT = join(REPO, 'scripts', 'with-watchdog.mjs')
let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'watchdog-test-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

/** 워치독을 돌린다. `flags` 뒤에 `--` 와 `node -e <code>` 가 붙는다. 시도 횟수는 `attempts` 파일의 줄 수. */
function run(flags: string[], code: string) {
  const attempts = join(dir, 'attempts')
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--poll', '100', ...flags, '--', process.execPath, '-e', code],
    {
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, ATTEMPTS: attempts, DIR: dir },
    },
  )
  const count = existsSync(attempts) ? readFileSync(attempts, 'utf8').trim().split('\n').length : 0
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, attempts: count }
}

const COUNT = `require('fs').appendFileSync(process.env.ATTEMPTS, 'x\\n');`
const HANG = `setInterval(() => {}, 1000);` // 0% CPU · 출력 없음 — 교착과 같은 모양

describe('with-watchdog', () => {
  it('passes through output and exit code 0', () => {
    const r = run(['--wall', '20'], `console.log('hello')`)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('hello')
  })

  it('does not retry a real failure — exits with the same code after one attempt', () => {
    const r = run(['--wall', '20', '--retries', '5'], `${COUNT} process.exit(7)`)
    expect(r.status).toBe(7)
    expect(r.attempts).toBe(1)
  })

  it('kills a hang on the wall-clock limit and retries until retries are used up (exit 124)', () => {
    const r = run(['--wall', '1', '--retries', '2'], `${COUNT} ${HANG}`)
    expect(r.status).toBe(124)
    expect(r.attempts).toBe(3)
    expect(r.stderr).toMatch(/wall-clock/)
  })

  it('succeeds when a retry gets through after a hang', () => {
    const marker = join(dir, 'seen')
    const r = run(
      ['--wall', '1', '--retries', '2'],
      `${COUNT} const fs = require('fs'); const m = ${JSON.stringify(marker)};
       if (!fs.existsSync(m)) { fs.writeFileSync(m, ''); ${HANG} } else { console.log('second try ok') }`,
    )
    expect(r.status).toBe(0)
    expect(r.attempts).toBe(2)
    expect(r.stdout).toContain('second try ok')
  })

  it('kills a silent process that makes no CPU progress after --idle seconds, long before the wall limit', () => {
    const t0 = Date.now()
    const r = run(['--wall', '60', '--idle', '1', '--retries', '0'], `${COUNT} ${HANG}`)
    expect(r.status).toBe(124)
    expect(r.stderr).toMatch(/no output and no CPU/)
    expect(Date.now() - t0).toBeLessThan(15_000)
  })

  it('does not kill a silent process that is busy on the CPU', () => {
    const r = run(
      ['--wall', '60', '--idle', '1', '--retries', '0'],
      `const end = Date.now() + 3000; while (Date.now() < end) {} console.log('busy done')`,
    )
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('busy done')
  })

  it('does not kill an idle process that keeps printing', () => {
    const r = run(
      ['--wall', '60', '--idle', '1', '--retries', '0'],
      `let n = 0; const t = setInterval(() => { console.log('tick'); if (++n === 12) { clearInterval(t) } }, 250)`,
    )
    expect(r.status).toBe(0)
  })

  it('kills the whole process tree, not just the direct child', () => {
    const pidFile = join(dir, 'grandchild.pid')
    run(
      ['--wall', '1', '--retries', '0'],
      `const { spawn } = require('child_process');
       const g = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
       require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(g.pid)); setInterval(() => {}, 1000)`,
    )
    const pid = Number(readFileSync(pidFile, 'utf8'))
    const alive = () => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    }
    const deadline = Date.now() + 3000
    while (alive() && Date.now() < deadline) appendFileSync(join(dir, 'spin'), '') // 잠깐 기다린다
    expect(alive()).toBe(false)
  })

  it('rejects a missing command with exit 2', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--wall', '5'], { encoding: 'utf8' })
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/usage/)
  })
})
