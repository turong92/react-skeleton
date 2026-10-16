import { afterAll, beforeAll, expect, it } from 'vitest'
import { startFakeProviders, type FakeProviders } from './fakeProviders'

/*
 * 가짜 LINE · X 는 IPv4 루프백(127.0.0.1)에서 받는다. 백엔드(JVM)는 `localhost` 를 IPv4 로 먼저 풀지만 Node 는 리눅스(glibc)에서 ::1 로 먼저 풀어,
 * 이름으로 열면 ::1 에서만 받아 백엔드의 토큰 교환이 거절당했다(CI 에서만 소셜 e2e 가 끝나지 않았다). 맥은 `localhost` 가 127.0.0.1 로 먼저 풀려 가려졌다.
 */
let fake: FakeProviders
beforeAll(async () => {
  fake = await startFakeProviders()
})
afterAll(async () => {
  await fake?.close()
})

it('answers on the IPv4 loopback address, whatever order `localhost` resolves in', async () => {
  const { port } = new URL(fake.url)
  const res = await fetch(`http://127.0.0.1:${port}/control`, { method: 'POST', body: '{}' })
  expect(res.status).toBe(200)
})
