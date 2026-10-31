export type PushWorkerOptions = {
  /** 알림 아이콘의 주소(앱 안 경로) */
  icon?: string
}

/**
 * 서비스 워커 소스 — 의존이 없는 작은 파일 하나(빌드 도구를 거치지 않고 그대로 나간다).
 * - `push`: JSON `{ v: 1, title, body, tag, link }` 를 읽어 **항상** 알림을 띄운다(Chrome 은 `userVisibleOnly` 라 안 띄우면 기본 문구를 대신 띄운다).
 * - `notificationclick`: `link` 가 앱 안 경로일 때만 따라간다(`/` 로 시작, `//` · `\` · 제어 문자 없음, 같은 출처로 풀림). 열린 같은 출처 창이 있으면 앞으로 + 이동, 없으면 새 창.
 * - `pushsubscriptionchange` 는 다루지 않는다 — 워커에는 로그인이 없어 서버에 알릴 수 없고, 다음 `usePushSync` 가 고친다.
 */
export function pushWorkerSource({ icon }: PushWorkerOptions = {}): string {
  return String.raw`'use strict';
var ICON = ${JSON.stringify(icon ?? null)};
var ORIGIN = self.location.origin;

function appPath(link) {
  if (typeof link !== 'string' || link.charAt(0) !== '/' || link.charAt(1) === '/') return null;
  if (/[\\\u0000-\u001f\u007f]/.test(link)) return null;
  try {
    return new URL(link, ORIGIN).origin === ORIGIN ? link : null;
  } catch (error) {
    return null;
  }
}

function text(value) {
  return typeof value === 'string' && value ? value : undefined;
}

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = (event.data && event.data.json()) || {};
  } catch (error) {
    data = {};
  }
  if (typeof data !== 'object') data = {};
  var options = { body: text(data.body), tag: text(data.tag), data: { link: appPath(data.link) } };
  if (ICON) options.icon = ICON;
  event.waitUntil(self.registration.showNotification(text(data.title) || 'New notification', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var link = appPath(event.notification.data && event.notification.data.link);
  var target = new URL(link || '/', ORIGIN).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      var open = windows.filter(function (w) {
        try {
          return new URL(w.url).origin === ORIGIN;
        } catch (error) {
          return false;
        }
      })[0];
      if (!open) return self.clients.openWindow(target);
      return open
        .focus()
        .then(function () {
          return link ? open.navigate(target) : undefined;
        })
        .catch(function () {
          return self.clients.openWindow(target);
        });
    })
  );
});
`
}
