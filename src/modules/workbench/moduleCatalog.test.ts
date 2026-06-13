import { describe, expect, it } from 'vitest'
import { FALLBACK_WORKBENCH_MODULES, toWorkbenchModules } from './moduleCatalog'
import type { SkeletonModuleResponse } from './skeletonWorkbenchClient'

describe('toWorkbenchModules', () => {
  it('keeps persistence visible in the fallback catalog', () => {
    expect(FALLBACK_WORKBENCH_MODULES.map((module) => module.title)).toContain('persistence')
  })

  it('maps backend module status and operational details into display cards', () => {
    const modules: SkeletonModuleResponse[] = [
      {
        id: 'redis-lock',
        group: 'redis',
        status: 'DISABLED',
        configPrefix: 'skeleton.redis-lock',
        requiredInfrastructure: ['Redis at startup when enabled'],
        beans: [],
      },
      {
        id: 'platform',
        group: 'foundation',
        status: 'ACTIVE',
        configPrefix: 'skeleton.*',
        requiredInfrastructure: [],
        beans: ['traceIdFilter'],
        note: 'Response envelopes and trace context.',
      },
    ]

    expect(toWorkbenchModules(modules)).toEqual([
      {
        title: 'redis-lock',
        status: 'disabled',
        group: 'redis',
        details: ['skeleton.redis-lock', 'infra: Redis at startup when enabled'],
      },
      {
        title: 'platform',
        status: 'active',
        group: 'foundation',
        details: ['skeleton.*', 'beans: 1', 'Response envelopes and trace context.'],
      },
    ])
  })
})
