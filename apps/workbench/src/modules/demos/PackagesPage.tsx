import { Card, Tabs } from '@skeleton/ui'
import { useRef, useState } from 'react'
import { CaptchaDemo } from './CaptchaDemo'
import { NotificationsDemo } from './NotificationsDemo'
import { createPackagesDemoClient } from './packagesClient'
import { PaymentDemo } from './PaymentDemo'
import { SocialDemo } from './SocialDemo'
import { StorageDemo } from './StorageDemo'
import { UiDemo } from './UiDemo'

/**
 * 새 패키지 예제 화면(`/packages`) — 패키지마다 한 탭. 워크벤치가 백엔드 모듈을 눌러 보는 곳이듯,
 * 여기서는 `@skeleton/notifications` · `storage` · `payment` · `captcha-turnstile` · `auth` 의 소셜 도우미 · `ui` 의 새 부품을 눌러 본다.
 */
export function PackagesPage() {
  const [identity, setIdentity] = useState('acc_demo')
  const identityRef = useRef(identity)
  // eslint-disable-next-line react-hooks/refs -- 클라이언트는 요청을 보낼 때(이벤트) 신원을 읽는다. 렌더 중에 읽지 않는다
  const [client] = useState(() =>
    createPackagesDemoClient({ getIdentity: () => identityRef.current }),
  )
  const changeIdentity = (value: string) => {
    identityRef.current = value
    setIdentity(value)
  }
  return (
    <Card title="패키지 예제">
      <Tabs
        aria-label="패키지"
        items={[
          {
            id: 'notifications',
            label: 'notifications',
            content: (
              <NotificationsDemo client={client} identity={identity} onIdentity={changeIdentity} />
            ),
          },
          { id: 'storage', label: 'storage', content: <StorageDemo client={client} /> },
          { id: 'payment', label: 'payment', content: <PaymentDemo client={client} /> },
          { id: 'captcha', label: 'captcha-turnstile', content: <CaptchaDemo /> },
          { id: 'social', label: 'auth · social', content: <SocialDemo /> },
          { id: 'ui', label: 'ui', content: <UiDemo /> },
        ]}
      />
    </Card>
  )
}
