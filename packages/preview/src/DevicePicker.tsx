import { Button } from '@skeleton/ui'
import { DEVICE_ICON } from './deviceIcons'
import { PREVIEW_DEVICES, type PreviewDevice } from './devices'
import type { PreviewLabels } from './labels'
import { defaultPreviewLabels } from './labels.en'
import styles from './controls.module.css'

export type DevicePickerProps = {
  value: PreviewDevice
  onChange: (device: PreviewDevice) => void
  labels?: PreviewLabels
}

/** 기기 넷 고르기 — 고른 것은 채운 단추 + `aria-pressed`. 태블릿 가로는 같은 아이콘을 눕힌다 */
export function DevicePicker({
  value,
  onChange,
  labels = defaultPreviewLabels,
}: DevicePickerProps) {
  return (
    <div role="group" aria-label={labels.device} className={styles.group}>
      {PREVIEW_DEVICES.map((device) => {
        const Icon = DEVICE_ICON[device]
        const label = labels.devices[device]
        const pressed = device === value
        return (
          <Button
            key={device}
            size="sm"
            variant={pressed ? 'primary' : 'ghost'}
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            onClick={() => onChange(device)}
          >
            <Icon
              aria-hidden
              size={20}
              className={device === 'tabletLandscape' ? styles.turned : undefined}
            />
          </Button>
        )
      })}
    </div>
  )
}
