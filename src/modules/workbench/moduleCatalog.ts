import type { WorkbenchModule } from './workbenchTypes'

export const WORKBENCH_MODULES: WorkbenchModule[] = [
  {
    title: 'platform',
    status: 'wired',
    details: ['Response.ok', 'traceparent', 'Swagger', 'Problem Details'],
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
    title: 'storage',
    status: 'split',
    details: ['core contract', 'S3 presign'],
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
