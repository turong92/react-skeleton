import type { WorkbenchModule } from './workbenchTypes'
import type { SkeletonModuleResponse, SkeletonModuleStatus } from './skeletonWorkbenchClient'

export const FALLBACK_WORKBENCH_MODULES: WorkbenchModule[] = [
  {
    title: 'platform',
    status: 'wired',
    details: ['Response.ok', 'traceparent', 'Swagger', 'External HTTP'],
  },
  {
    title: 'auth',
    status: 'wired',
    details: ['JWT', 'dev login', 'break-glass', 'stateless'],
  },
  {
    title: 'web',
    status: 'wired',
    details: ['CORS', 'public endpoints', 'rate limit', 'headers'],
  },
  {
    title: 'notification',
    status: 'split',
    details: ['SSE', 'WebSocket', 'Slack alert'],
  },
  {
    title: 'redis',
    status: 'split',
    details: ['cache', 'rate-limit', 'lock retry'],
  },
  {
    title: 'persistence',
    status: 'split',
    details: ['JPA audit', 'JDBC audit', 'partial update', 'fetch graph'],
  },
  {
    title: 'storage',
    status: 'split',
    details: ['object storage', 'S3 presign', 'copy/list', 'public URL'],
  },
  {
    title: 'event',
    status: 'split',
    details: ['Spring event', 'Kafka bridge', 'trace headers'],
  },
  {
    title: 'payment',
    status: 'split',
    details: ['router', 'Toss', 'Stripe'],
  },
]

export function toWorkbenchModules(modules: SkeletonModuleResponse[]): WorkbenchModule[] {
  return modules.map((module) => ({
    title: module.id,
    status: toWorkbenchStatus(module.status),
    group: module.group,
    details: [
      module.configPrefix,
      ...(module.beans.length > 0 ? [`beans: ${module.beans.length}`] : []),
      ...module.requiredInfrastructure.map((item) => `infra: ${item}`),
      ...(module.note ? [module.note] : []),
    ],
  }))
}

function toWorkbenchStatus(status: SkeletonModuleStatus): WorkbenchModule['status'] {
  switch (status) {
    case 'ACTIVE':
      return 'active'
    case 'DISABLED':
      return 'disabled'
    case 'MISSING':
      return 'missing'
  }
}
