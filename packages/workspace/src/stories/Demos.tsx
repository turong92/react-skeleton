import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AcceptInvitation } from '../AcceptInvitation'
import { CreateWorkspaceForm } from '../CreateWorkspaceForm'
import { createCurrentWorkspace, createWorkspaceHeaders } from '../currentWorkspace'
import { INVITATION_TOKEN_STORAGE_KEY, type UrlHost } from '../invitationToken'
import { koWorkspaceLabels } from '../labels'
import { createLastWorkspaceMemory } from '../lastWorkspace'
import { memoryStorage } from '../test/memoryStorage'
import { useWorkspace } from '../workspaceContext'
import { WorkspaceProvider } from '../WorkspaceProvider'
import { WorkspaceInvitations } from '../WorkspaceInvitations'
import { WorkspaceSettings } from '../WorkspaceSettings'
import { WorkspaceSwitcher } from '../WorkspaceSwitcher'
import { createFakeWorkspaces, ME, type FakeWorkspacesOptions } from './fakeWorkspaces'
import { WithQuery } from './WithQuery'

/*
 * 스토리용 화면 — 가짜 서버를 스토리를 열 때 한 번만 만들고(인자로 만들면 다시 그릴 때마다 상태가 사라진다),
 * 앱이 라우터로 하는 일(주소 바꾸기 · 이동)은 「앱이 한 일」 줄(`role="status"`)에 적어 play 가 읽는다.
 */
function Log({ lines }: { lines: string[] }) {
  return (
    <p role="status" aria-label="log">
      {lines.join(' | ')}
    </p>
  )
}

export function SwitcherDemo({ currentSlug }: { currentSlug?: string }) {
  const [{ api }] = useState(() => createFakeWorkspaces())
  const [lines, setLines] = useState<string[]>([])
  return (
    <WithQuery>
      <WorkspaceSwitcher
        api={api}
        currentSlug={currentSlug}
        labels={koWorkspaceLabels}
        onSelect={(w) => setLines((l) => [...l, `select:${w.slug}`])}
        onCreate={() => setLines((l) => [...l, 'create'])}
      />
      <Log lines={lines} />
    </WithQuery>
  )
}

export function CreateDemo({ breakWrites }: Pick<FakeWorkspacesOptions, 'breakWrites'>) {
  const [{ api }] = useState(() => createFakeWorkspaces({ breakWrites }))
  const [lines, setLines] = useState<string[]>([])
  return (
    <WithQuery>
      <CreateWorkspaceForm
        api={api}
        labels={koWorkspaceLabels}
        onCreated={(w) => setLines((l) => [...l, `created:${w.slug}`])}
        onCancel={() => setLines((l) => [...l, 'cancel'])}
      />
      <Log lines={lines} />
    </WithQuery>
  )
}

function Body({ children }: { children: (workspaceName: string) => ReactNode }) {
  const workspace = useWorkspace()
  return workspace ? <>{children(workspace.name)}</> : null
}

function SettingsBody({
  api,
  onLeft,
}: {
  api: ReturnType<typeof createFakeWorkspaces>['api']
  onLeft: () => void
}) {
  const workspace = useWorkspace()
  if (!workspace) return null
  return (
    <WorkspaceSettings
      api={api}
      workspace={workspace}
      accountId={ME}
      onLeft={onLeft}
      labels={koWorkspaceLabels}
      locale="ko-KR"
    />
  )
}

/** 앱이 하는 조립 그대로 — Provider 가 주소의 slug 를 풀고, 설정 화면은 풀린 워크스페이스를 받는다 */
export function SettingsDemo({
  role,
  breakWrites,
  slug = 'acme',
}: FakeWorkspacesOptions & { slug?: string }) {
  const [{ api }] = useState(() => createFakeWorkspaces({ role, breakWrites }))
  const [current] = useState(createCurrentWorkspace)
  const [address, setAddress] = useState(slug)
  const [lines, setLines] = useState<string[]>([])
  return (
    <WithQuery>
      <WorkspaceProvider
        api={api}
        slug={address}
        current={current}
        labels={koWorkspaceLabels}
        onCanonicalSlug={(next) => {
          setLines((l) => [...l, `address:${next}`])
          setAddress(next)
        }}
      >
        <SettingsBody api={api} onLeft={() => setLines((l) => [...l, 'left'])} />
      </WorkspaceProvider>
      <Log lines={lines} />
    </WithQuery>
  )
}

function HeaderProbe({ headers }: { headers: () => Record<string, string> }) {
  const out = useRef<HTMLParagraphElement>(null)
  // 자식의 effect 는 Provider 의 레이아웃 효과 뒤에 돈다 — 이 시점에 헤더가 이미 있어야 자식의 첫 요청에 실린다
  useEffect(() => {
    if (out.current) out.current.textContent = `header:${JSON.stringify(headers())}`
  }, [headers])
  return <p ref={out} />
}

export function ProviderDemo({ slug }: { slug: string }) {
  const [{ api }] = useState(() => createFakeWorkspaces({ oldSlug: 'acme-old' }))
  const [current] = useState(createCurrentWorkspace)
  const [headers] = useState(() => createWorkspaceHeaders(current))
  const [memory] = useState(() => createLastWorkspaceMemory(memoryStorage(), ME))
  const [lines, setLines] = useState<string[]>([])
  return (
    <WithQuery>
      <WorkspaceProvider
        api={api}
        slug={slug}
        current={current}
        memory={{
          write: (s) => {
            memory.write(s)
            setLines((l) => [...l, `remember:${memory.read()}`])
          },
        }}
        onCanonicalSlug={(next) => setLines((l) => [...l, `address:${next}`])}
        labels={koWorkspaceLabels}
      >
        <Body>{(name) => <p>{`app:${name}`}</p>}</Body>
        <HeaderProbe headers={headers} />
      </WorkspaceProvider>
      <Log lines={lines} />
    </WithQuery>
  )
}

function InvitationsBody({ api }: { api: ReturnType<typeof createFakeWorkspaces>['api'] }) {
  const workspace = useWorkspace()
  if (!workspace) return null
  return (
    <WorkspaceInvitations
      api={api}
      workspace={workspace}
      labels={koWorkspaceLabels}
      locale="ko-KR"
    />
  )
}

/** 앱이 하는 조립 그대로 — Provider 가 풀어 준 워크스페이스(좌석 수 포함)를 초대 부품이 받는다 */
export function InvitationsDemo({ role, seatLimit }: FakeWorkspacesOptions) {
  const [{ api }] = useState(() => createFakeWorkspaces({ role, seatLimit }))
  const [current] = useState(createCurrentWorkspace)
  return (
    <WithQuery>
      <WorkspaceProvider
        api={api}
        slug="acme"
        current={current}
        labels={koWorkspaceLabels}
        onCanonicalSlug={() => {}}
      >
        <InvitationsBody api={api} />
      </WorkspaceProvider>
    </WithQuery>
  )
}

/**
 * 수락 화면 — `token` 은 메일 링크가 주소에 실어 온 값(`inAddress`) 아니면 로그인하고 돌아온 탭 저장소의 값.
 * 주소창은 가짜라 지워지는 모습이 「앱이 한 일」 줄에 `address:<지운 뒤 주소>` 로 남는다
 */
export function AcceptDemo({
  token,
  signedIn,
  inAddress = false,
}: {
  token: string | null
  signedIn: boolean
  inAddress?: boolean
}) {
  const [{ api }] = useState(() => createFakeWorkspaces())
  const [lines, setLines] = useState<string[]>([])
  const [storage] = useState(() =>
    memoryStorage(token && !inAddress ? { [INVITATION_TOKEN_STORAGE_KEY]: token } : {}),
  )
  const [host] = useState<UrlHost>(() => ({
    location: {
      pathname: '/invite',
      search: token && inAddress ? `?token=${token}` : '',
      hash: '',
    },
    history: {
      state: null,
      replaceState: (_s, _t, url) => setLines((l) => [...l, `address:${url}`]),
    },
  }))
  return (
    <WithQuery>
      <AcceptInvitation
        api={api}
        signedIn={signedIn}
        storage={storage}
        urlHost={host}
        labels={koWorkspaceLabels}
        locale="ko-KR"
        onSignIn={() => setLines((l) => [...l, 'sign-in'])}
        onAccepted={(w) =>
          setLines((l) => [
            ...l,
            `accepted:${w.slug}`,
            `stored:${storage.getItem(INVITATION_TOKEN_STORAGE_KEY) ?? 'none'}`,
          ])
        }
        onGoHome={() => setLines((l) => [...l, 'home'])}
      />
      <Log lines={lines} />
    </WithQuery>
  )
}
