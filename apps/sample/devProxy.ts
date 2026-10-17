import type { Plugin, ProxyOptions } from 'vite'

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

/** 공개 접두사 밖으로 나가려는 경로인가 - `..` · 인코딩된 점(`%2e`) · 역슬래시(`%5c`) · 널 문자가 든 것 */
export function isUnsafeFilesPath(url: string): boolean {
  const path = url.split('?')[0] ?? ''
  return /(\.\.|%2e|%5c|%00|\\)/i.test(path)
}

/**
 * `/files/public` 프록시 앞에 서는 문지기 - 경로가 공개 접두사 밖(비공개 업로드 영역)을 가리킬 수 있으면 프록시하지 않고 400 으로 돌려준다.
 * (Vite 의 프록시 `bypass` 는 400 을 낼 수 없어 플러그인 미들웨어로 한다. 프록시보다 먼저 선다.)
 */
export function filesPathGuard(): Plugin {
  return {
    name: 'files-path-guard',
    configureServer(server) {
      server.middlewares.use('/files/public', (req, res, next) => {
        if (isUnsafeFilesPath(req.originalUrl ?? req.url ?? '')) {
          res.statusCode = 400
          res.end('Bad path')
          return
        }
        next()
      })
    },
  }
}
