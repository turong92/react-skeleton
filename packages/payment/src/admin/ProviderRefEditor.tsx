import { Button, Input } from '@skeleton/ui'
import { useState } from 'react'
import type { PaymentLabels } from '../labelTypes'
import styles from './AdminPriceList.module.css'

type Props = {
  priceCode: string
  provider: string
  /** 지금 연결된 결제사 가격 id, 없으면 `undefined` */
  linked: string | undefined
  busy: boolean
  onSave: (externalId: string) => void
  onRemove: () => void
  labels: PaymentLabels
}

/** 가격 한 줄의 결제사 가격 id 한 칸 - 적어서 「연결」, 이어진 것은 「연결 끊기」 */
export function ProviderRefEditor({
  priceCode,
  provider,
  linked,
  busy,
  onSave,
  onRemove,
  labels,
}: Props) {
  const text = labels.admin.catalog.prices.links
  const name = text.provider(provider)
  const [draft, setDraft] = useState(linked ?? '')
  const [seen, setSeen] = useState(linked)
  if (linked !== seen) {
    setSeen(linked)
    setDraft(linked ?? '')
  }
  const trimmed = draft.trim()
  return (
    <form
      className={styles.link}
      aria-label={text.idLabel(name, priceCode)}
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed !== '' && trimmed !== linked && !busy) onSave(trimmed)
      }}
    >
      <Input
        value={draft}
        placeholder={linked === undefined ? text.notLinked : undefined}
        aria-label={text.idLabel(name, priceCode)}
        disabled={busy}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        loading={busy}
        loadingLabel={labels.admin.catalog.prices.links.save}
        disabled={trimmed === '' || trimmed === linked}
        aria-label={text.saveFor(name, priceCode)}
      >
        {text.save}
      </Button>
      {linked !== undefined && (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          aria-label={text.removeFor(name, priceCode)}
          onClick={onRemove}
        >
          {text.remove}
        </Button>
      )}
    </form>
  )
}
