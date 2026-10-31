import type { PushLabels } from './labels'

/** 기본 문구(영어) */
export const defaultPushLabels: PushLabels = {
  loading: 'Loading',
  loadFailed: 'Could not load the push settings.',
  retry: 'Try again',
  prompt: {
    title: 'Get notified on this device',
    description:
      'Turn on push notifications to hear about new activity even when this tab is closed.',
    enable: 'Turn on notifications',
    later: 'Not now',
  },
  settings: {
    switchTitle: 'Receive push notifications on this device',
    switchDescription: 'Notifications arrive even when this page is closed.',
    enableFailed: 'Could not turn on push notifications. Try again.',
    disableFailed: 'Could not turn off push notifications. Try again.',
    denied: {
      title: 'Notifications are blocked in this browser',
      description:
        'Allow notifications for this site in your browser settings (the lock icon next to the address), then come back and turn them on.',
    },
    needsInstall: {
      title: 'Add this app to your Home Screen first',
      description:
        'On iPhone and iPad, push notifications work only in the installed app. Use Share, then Add to Home Screen, and open it from there.',
    },
    unsupported: {
      title: 'This browser cannot receive push notifications',
      description: 'Try a recent version of Chrome, Edge, Firefox or Safari.',
    },
    notConfigured: {
      title: 'Push notifications are not available',
      description: 'This service has not turned on web push.',
    },
    test: {
      action: 'Send a test notification',
      sent: 'Test notification sent.',
      tooSoon: 'Wait a minute before sending another test.',
      failed: 'Could not send the test notification.',
    },
    devices: {
      title: 'Your other devices',
      caption: 'Devices that receive push notifications',
      empty: 'No other devices.',
      columnName: 'Device',
      columnLastSeen: 'Last seen',
      columnActions: 'Actions',
      kind: { WEBPUSH: 'Web browser', FCM: 'Mobile app' },
      remove: 'Remove',
      removeFor: (name) => `Remove ${name}`,
      removeFailed: 'Could not remove the device.',
    },
    types: {
      title: 'What to push',
      description: 'Turning one off only stops the push. It still shows up in your notifications.',
      empty: 'No notification types to configure.',
      allMuted: 'All notifications are turned off.',
      saveFailed: 'Could not save the change.',
      names: {},
    },
  },
}
