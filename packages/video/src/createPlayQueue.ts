import type { LoadHls } from './attachSource'
import { createAudioEngine } from './audioEngine'
import { readBrowserEnv } from './browserEnv'
import { HLS_MIME, type PlaybackEnv } from './playbackPlan'
import { createQueueController, type QueueController } from './queueController'
import type { QueueStorage } from './queueStorage'

function engineOf(env: PlaybackEnv): 'native' | 'hlsjs' | null {
  return env.canPlayType(HLS_MIME) ? 'native' : env.mse ? 'hlsjs' : null
}

/** 이 기기의 HLS 엔진으로 `<audio>` 를 모는 대기열 컨트롤러를 만든다(`PlayQueueProvider` 가 한 번 부른다) */
export function createPlayQueue(options: {
  storage?: QueueStorage
  storageKey?: string
  /** 고른 소리 장치를 이 기기에 기억할 키 - 없으면 기억하지 않는다 */
  outputDeviceKey?: string
  env?: PlaybackEnv
  loadHls: LoadHls
}): QueueController {
  const audio = createAudioEngine({
    engine: () => engineOf(options.env ?? readBrowserEnv()),
    loadHls: options.loadHls,
    onFatal: () => controller.audioFailed(),
    onPlayRejected: () => controller.audioRejected(),
  })
  const controller: QueueController = createQueueController({
    audio,
    storage: options.storage,
    storageKey: options.storageKey,
    outputDeviceKey: options.outputDeviceKey,
  })
  return controller
}
