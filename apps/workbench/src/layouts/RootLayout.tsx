import { Link, Outlet } from 'react-router-dom'
import { API_BASE_URL, apiEndpoint } from '../api/client'
import { ThemeToggle } from '@skeleton/theme'

export function RootLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand-lockup" aria-label="skeleton workbench home">
          <span className="brand-mark">SK</span>
          <span>
            <strong>skeleton</strong>
            <small>frontend workbench</small>
          </span>
        </Link>
        <nav className="header-actions" aria-label="backend links">
          <Link to="/packages">packages</Link>
          <code>{API_BASE_URL}</code>
          <a href={apiEndpoint('/docs/ui')} target="_blank" rel="noreferrer">
            Swagger
          </a>
          <ThemeToggle />
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
