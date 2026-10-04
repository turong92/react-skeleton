import type { ReactNode } from 'react'
import { Copy, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { AuthPrincipal } from '../../api/types'
import { formatJson } from './workbenchUtils'
import type { Exchange } from './workbenchTypes'

export function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="section-title">
      {icon}
      <h2>{title}</h2>
    </div>
  )
}

export function ActionButton({
  label,
  icon,
  busy,
  disabled,
  onClick,
}: {
  label: string
  icon: ReactNode
  busy?: boolean
  disabled?: boolean
  onClick: () => void | Promise<void>
}) {
  return (
    <button
      type="button"
      className="action-button"
      disabled={disabled || busy}
      onClick={onClick}
      title={label}
    >
      {busy ? <RefreshCcw size={16} className="spin" /> : icon}
      <span>{label}</span>
    </button>
  )
}

export function PrincipalStrip({ principal }: { principal: AuthPrincipal | null }) {
  if (!principal) {
    return <div className="principal-strip">no bearer principal</div>
  }
  return (
    <div className="principal-strip">
      <strong>{principal.accountId}</strong>
      <span>{principal.email ?? '-'}</span>
      <span>{principal.roles.join(', ')}</span>
    </div>
  )
}

export function ExchangeLog({ exchange }: { exchange: Exchange }) {
  return (
    <article className="exchange-item">
      <header>
        <div>
          <strong>{exchange.label}</strong>
          <code>
            {exchange.method} {exchange.path}
          </code>
        </div>
        <span data-ok={exchange.status !== undefined && exchange.status < 400}>
          {exchange.status ?? 'ERR'} · {exchange.durationMs}ms
        </span>
      </header>
      <div className="trace-row">
        <code>traceId={exchange.traceId ?? '-'}</code>
        <code>spanId={exchange.spanId ?? '-'}</code>
        <button
          type="button"
          className="icon-button"
          title="copy exchange"
          onClick={() => copy(formatJson(exchange))}
        >
          <Copy size={14} />
        </button>
      </div>
      <div className="json-grid">
        <pre>{formatJson({ request: exchange.request })}</pre>
        <pre>
          {formatJson(exchange.error ? { error: exchange.error } : { response: exchange.response })}
        </pre>
      </div>
    </article>
  )
}

async function copy(value: string) {
  await navigator.clipboard.writeText(value)
  toast.success('copied')
}
