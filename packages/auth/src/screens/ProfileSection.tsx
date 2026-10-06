import { Alert, Button, Field, Input, Select, SectionCard } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import type { ProfilePatch } from '../account/types'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type ProfileSectionProps = {
  profile: { displayName: string | null; locale: string | null; timeZone: string | null }
  /** 고를 수 있는 언어(백엔드가 허용하는 BCP47 목록과 맞춘다) */
  locales: Array<{ value: string; label: string }>
  /** 고를 수 있는 시간대(IANA). 보통 `Intl.supportedValuesOf('timeZone')` */
  timeZones: string[]
  onSave: (patch: ProfilePatch) => Promise<unknown>
  labels?: Partial<AuthLabels>
}

/** 프로필 절 — 표시 이름 · 언어 · 시간대 */
export function ProfileSection({
  profile,
  locales,
  timeZones,
  onSave,
  labels: given,
}: ProfileSectionProps) {
  const labels = mergeLabels(given)
  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [locale, setLocale] = useState(profile.locale ?? '')
  const [timeZone, setTimeZone] = useState(profile.timeZone ?? '')
  const [saved, setSaved] = useState(false)
  const action = useAction(labels)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    const patch: ProfilePatch = {}
    if (displayName.trim() && displayName !== (profile.displayName ?? ''))
      patch.displayName = displayName.trim()
    if (locale && locale !== (profile.locale ?? '')) patch.locale = locale
    if (timeZone && timeZone !== (profile.timeZone ?? '')) patch.timeZone = timeZone
    if (Object.keys(patch).length === 0) return setSaved(true)
    setSaved(await action.run(() => onSave(patch)))
  }

  return (
    <SectionCard id="profile" title={labels.sectionProfile}>
      <form className={styles.form} onSubmit={submit} aria-label={labels.sectionProfile}>
        {action.error && <Alert tone="danger">{action.error.message}</Alert>}
        {saved && <Alert tone="success">{labels.profileSaved}</Alert>}
        <Field label={labels.displayName}>
          {(control) => (
            <Input
              {...control}
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
        </Field>
        <Field label={labels.profileLocale}>
          {(control) => (
            <Select {...control} value={locale} onChange={(e) => setLocale(e.target.value)}>
              {!profile.locale && <option value="">{labels.profileLocaleDefault}</option>}
              {locales.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={labels.profileTimeZone}>
          {(control) => (
            <Select {...control} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {!profile.timeZone && <option value="">{labels.profileLocaleDefault}</option>}
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div>
          <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
            {labels.save}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}
