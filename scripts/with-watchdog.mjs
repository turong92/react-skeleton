#!/usr/bin/env node
// 멈춘 명령을 끊고 다시 돈다 — rolldown(rc) 교착으로 vite build · vitest 가 0% CPU 로 영원히 매달리는 일(README "알려진 함정")의 봉쇄책.
//
//   node scripts/with-watchdog.mjs [--wall <초>] [--idle <초>] [--retries <n>] [--poll <ms>] -- <명령> [인자...]
//
//   --wall     한 번의 시도가 이 시간(기본 600초)을 넘기면 끊는다
//   --idle     이 시간(기본 90초) 동안 출력도 없고 CPU 도 안 쓰면(= 교착) 끊는다. 출력 없이 CPU 를 쓰는 컴파일은 안 끊는다
//   --retries  끊긴 뒤 다시 도는 횟수(기본 2 → 최대 3번 시도)
//   --poll     CPU 를 재는 간격(밀리초, 기본 2000)
//
// 끊김(교착 의심)만 다시 돈다. 명령이 스스로 실패(0 아닌 종료 코드)하면 다시 돌지 않고 그 코드를 그대로 돌려준다 — 진짜 실패를 재시도로 가리지 않는다.
// 끊긴 채 재시도가 다 끝나면 124 로 끝난다. 프로세스 그룹째 죽인다(pnpm → sh → vite 가 낳은 손자까지).
// 의존성 없음 — Node 와 ps 만 쓴다(macOS · Linux).
import { spawn, execFileSync } from 'node:child_process'

const argv = process.argv.slice(2)
const split = argv.indexOf('--')
const flags = split === -1 ? argv : argv.slice(0, split)
const cmd = split === -1 ? [] : argv.slice(split + 1)

function usage(msg) {
  if (msg) console.error(`with-watchdog: ${msg}`)
  console.error(
    'usage: node scripts/with-watchdog.mjs [--wall <s>] [--idle <s>] [--retries <n>] [--poll <ms>] -- <command> [args...]',
  )
  process.exit(2)
}

const opt = { wall: 600, idle: 90, retries: 2, poll: 2000 }
for (let i = 0; i < flags.length; i += 2) {
  const key = flags[i].replace(/^--/, '')
  const value = Number(flags[i + 1])
  if (!(key in opt) || !flags[i].startsWith('--') || !Number.isFinite(value) || value < 0)
    usage(`bad option: ${flags[i]} ${flags[i + 1] ?? ''}`)
  opt[key] = value
}
if (cmd.length === 0) usage('missing command after --')

/** ps 의 CPU 시간("1:02.34" · "01:02:03" · "1-02:03:04")을 초로 */
function cpuSeconds(t) {
  const [days, rest] = t.includes('-') ? t.split('-') : ['0', t]
  return rest.split(':').reduce((acc, part) => acc * 60 + Number(part), 0) + Number(days) * 86400
}

/** 프로세스 그룹 pgid 가 쓴 CPU 초의 합 */
function groupCpu(pgid) {
  try {
    const out = execFileSync('ps', ['-A', '-o', 'pgid=,time='], { encoding: 'utf8' })
    let sum = 0
    for (const line of out.split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\S+)$/)
      if (m && Number(m[1]) === pgid) sum += cpuSeconds(m[2])
    }
    return sum
  } catch {
    return 0
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const killGroup = (pid, sig) => {
  try {
    process.kill(-pid, sig)
  } catch {
    /* 이미 없다 */
  }
}

/** 한 번 돈다 → { code } (스스로 끝남) | { killed: '이유' } */
function attempt() {
  return new Promise((resolve) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      detached: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    })
    const startedAt = Date.now()
    let lastProgress = startedAt
    let baseCpu = 0
    let done = false
    let reason = null

    const onData = (stream) => (chunk) => {
      lastProgress = Date.now()
      stream.write(chunk)
    }
    child.stdout.on('data', onData(process.stdout))
    child.stderr.on('data', onData(process.stderr))

    const kill = async (why) => {
      if (reason) return
      reason = why
      killGroup(child.pid, 'SIGTERM')
      await sleep(1500)
      killGroup(child.pid, 'SIGKILL')
    }

    const timer = setInterval(() => {
      if (done) return
      const now = Date.now()
      const cpu = groupCpu(child.pid)
      if (cpu < baseCpu) baseCpu = cpu
      if (cpu - baseCpu >= 0.05) {
        baseCpu = cpu
        lastProgress = now
      }
      if (now - startedAt >= opt.wall * 1000) kill(`wall-clock limit ${opt.wall}s exceeded`)
      else if (now - lastProgress >= opt.idle * 1000)
        kill(`no output and no CPU progress for ${opt.idle}s (deadlock?)`)
    }, opt.poll)

    child.on('close', (code, signal) => {
      done = true
      clearInterval(timer)
      killGroup(child.pid, 'SIGKILL') // 남은 손자
      if (reason) resolve({ killed: reason })
      else resolve({ code: code ?? 128 + (signal ? signalNumber(signal) : 0) })
    })
    child.on('error', (err) => {
      done = true
      clearInterval(timer)
      console.error(`with-watchdog: cannot run ${cmd[0]}: ${err.message}`)
      resolve({ code: 127 })
    })

    for (const sig of ['SIGINT', 'SIGTERM']) {
      process.once(sig, () => {
        killGroup(child.pid, sig)
        setTimeout(() => process.exit(128 + signalNumber(sig)), 2000).unref()
      })
    }
  })
}

const signalNumber = (sig) => ({ SIGINT: 2, SIGTERM: 15, SIGKILL: 9, SIGHUP: 1 })[sig] ?? 0

const total = opt.retries + 1
for (let n = 1; n <= total; n++) {
  const r = await attempt()
  if (r.killed === undefined) process.exit(r.code)
  const more = n < total
  console.error(
    `with-watchdog: attempt ${n}/${total} killed — ${r.killed}${more ? '; retrying' : '; giving up'}`,
  )
  if (!more) process.exit(124)
}
