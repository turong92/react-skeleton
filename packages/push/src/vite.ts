import { pushWorkerSource, type PushWorkerOptions } from './serviceWorker'

export type PushServiceWorkerOptions = PushWorkerOptions & {
  /** 워커 파일 이름 — 빌드 뿌리에 나가고 개발 서버도 같은 주소로 내준다(기본 `push-sw.js`) */
  fileName?: string
}

type EmitContext = {
  /** Vite 6+ — 서버(SSR) 번들 빌드를 알아본다. 없으면 브라우저 번들로 본다 */
  environment?: { config?: { consumer?: string } }
  emitFile(file: { type: 'asset'; fileName: string; source: string }): unknown
}

type DevServer = {
  middlewares: {
    use(
      handler: (
        req: { url?: string },
        res: { setHeader(name: string, value: string): unknown; end(body: string): unknown },
        next: () => void,
      ) => void,
    ): unknown
  }
}

/**
 * 푸시 서비스 워커를 만들어 낸다 — `vite.config.ts` 의 `plugins` 에 `pushServiceWorker({ icon: '/icon-192.png' })`.
 * 빌드는 뿌리에 `push-sw.js` 를 내고(서버 번들에는 내지 않는다), 개발 서버는 `base` 를 따른 같은 주소로 내준다.
 * Vite 플러그인 꼴(vite 를 import 하지 않는다). 앱은 `usePush` 의 `serviceWorkerUrl` 로 이 주소를 알려 준다(기본 `/push-sw.js`).
 */
export function pushServiceWorker({
  fileName = 'push-sw.js',
  ...worker
}: PushServiceWorkerOptions = {}) {
  const source = pushWorkerSource(worker)
  let base = '/'
  return {
    name: 'skeleton-push-service-worker',
    configResolved(config: { base: string }) {
      // 상대 base(`./`)나 빈 값은 개발 서버에서 뿌리로 본다
      base = config.base.startsWith('/') ? config.base : '/'
    },
    configureServer(server: DevServer) {
      const path = `${base.endsWith('/') ? base : `${base}/`}${fileName}`
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== path) return next()
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(source)
      })
    },
    generateBundle(this: EmitContext) {
      if (this.environment?.config?.consumer === 'server') return
      this.emitFile({ type: 'asset', fileName, source })
    },
  }
}
