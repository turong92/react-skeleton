import { Button } from '@skeleton/ui'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'
import type { SocialProviderButton } from './methods'

export type SocialButtonsProps = {
  providers: SocialProviderButton[]
  labels: AuthLabels
  onSelect: (provider: string) => void
  /** 버튼 글자를 바꾼다(계정 연결 화면의 「Google 연결」) — 기본은 로그인 문구 */
  textOf?: (provider: SocialProviderButton, providerName: string) => string
  disabled?: boolean
}

/** 소셜 제공자 버튼 묶음 — 어떤 제공자가 있는지는 앱의 설정이 정한다 */
export function SocialButtons({
  providers,
  labels,
  onSelect,
  textOf,
  disabled,
}: SocialButtonsProps) {
  return (
    <div className={styles.stack}>
      {providers.map((provider) => {
        const name = labels.providerNames[provider.provider] ?? provider.provider
        const text =
          provider.label ?? (textOf ? textOf(provider, name) : labels.signInWithProvider(name))
        return (
          <Button
            key={provider.provider}
            variant="secondary"
            disabled={disabled}
            onClick={() => onSelect(provider.provider)}
          >
            {provider.icon}
            {text}
          </Button>
        )
      })}
    </div>
  )
}
