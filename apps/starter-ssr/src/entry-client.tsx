import { initTheme } from '@skeleton/theme'
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css'
import { createClientApp } from './app/createClientApp'
import { browserTokenStorage } from './auth/storage'
import { readSsrState } from './ssr/head'

// 저장한 테마를 읽어 <html data-theme> 에 단다(첫 칠 전에는 <head> 의 인라인 스크립트가 이미 달았다)
initTheme()

// 서버가 그린 HTML(#root) 위에 이어받는다 — 서버가 HTML 에 넣어 보낸 쿼리 캐시를 읽어 첫 그림부터 데이터가 있다
hydrateRoot(
  document.getElementById('root')!,
  createClientApp({
    env: import.meta.env,
    storage: browserTokenStorage(),
    state: readSsrState(document),
    Router: BrowserRouter,
    debug: import.meta.env.DEV,
  }),
)
