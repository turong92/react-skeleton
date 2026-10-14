import type { ProxyOptions } from 'vite'

/** `a.localhost:5174` · `a.localhost` — 프로젝트 하나를 가리키는 개발용 주소(포트는 무시) */
const PROJECT_HOST = /^[^\s:/]+\.localhost(?::\d+)?$/i

/**
 * `/api/v1` 을 백엔드로 넘기는 개발 프록시. 한 백엔드가 요청 Host 로 프로젝트를 고르므로, 브라우저가 `<이름>.localhost` 로 들어왔으면
 * 그 Host 를 그대로(+ `X-Forwarded-Host`) 넘긴다. 그 밖의 주소(`localhost` · `127.0.0.1` · 터널 도메인)는 예전과 같다 — 백엔드가 자기 주소를 본다.
 */
export function apiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq, req) => {
        const host = req.headers.host
        if (!host || !PROJECT_HOST.test(host)) return
        proxyReq.setHeader('host', host)
        proxyReq.setHeader('x-forwarded-host', host)
      })
    },
  }
}
